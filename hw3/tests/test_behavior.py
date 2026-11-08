import unittest
from support import APP
from ai import ReceptionResult
from motion import body_clear, distance, segment_clear, trail_length
from navigation import astar
from restaurant import Requirements, RestaurantMap, Robot, Pedestrian, RESERVED, OCCUPIED
from seating import rank_tables
from simulation import Simulation, RETURNING, ESCORTING, BLOCKED, IDLE

class BehaviorTests(unittest.TestCase):
    def make(self, escort=False):
        s = Simulation()
        s.timer.stop()
        self.addCleanup(lambda: s.timer.stop())
        if escort:
            s._received(ReceptionResult(Requirements(party_size=4), ''))
            s.confirm()
        else:
            s.restaurant = RestaurantMap()
            s.robot = Robot(position=(5,5), goal=(12,5), task=RETURNING)
            s.group = None
            s.phase = RETURNING
            s._plan_route()
        return s

    def test_continuous_motion(self):
        s = self.make()
        s.step(.25)
        self.assertAlmostEqual(s.robot.visual_position[0], 5.25)
        self.assertEqual(s.robot.position, (5,5))

    def test_pause_and_time_scale(self):
        s = self.make()
        s.set_paused(True)
        s.step(5)
        self.assertEqual(s.simulated_time, 0)
        self.assertEqual(s.robot.visual_position, (5,5))
        s.set_paused(False)
        s.set_time_scale(4)
        s.step(.5)
        self.assertAlmostEqual(s.simulated_time, 2)
        self.assertAlmostEqual(s.robot.visual_position[0], 7)
        with self.assertRaises(ValueError): s.step(-1)
        with self.assertRaises(ValueError): s.set_time_scale(3)

    def test_sensor_range_and_memory(self):
        s = self.make()
        s.restaurant.obstacles.update({(8,5), (14,5)})
        s._sense()
        self.assertEqual(s.restaurant.known_obstacles, {(8,5)})
        s.robot.position = (1,5)
        s.robot.route = []
        s.restaurant.obstacles.clear()
        s._sense()
        self.assertEqual(s.restaurant.known_obstacles, {(8,5)})
        s.robot.position = (5,5)
        s._sense()
        self.assertFalse(s.restaurant.known_obstacles)

    def test_unknown_obstacle_does_not_leak_to_planner(self):
        s = self.make()
        s.restaurant.obstacles.add((10,5))
        s._plan_route()
        self.assertIn((10,5), s.robot.route)
        s.step(1.1)
        self.assertIn((10,5), s.restaurant.known_obstacles)
        self.assertNotIn((10,5), s.robot.route)
        self.assertTrue(body_clear(s.robot.visual_position, s.restaurant))

    def test_navigation_explicit_blocked(self):
        r = RestaurantMap()
        r.obstacles.add((2,1))
        known = astar(r, (1,1), (3,1), r.known_blocked_cells)
        actual = astar(r, (1,1), (3,1))
        self.assertIn((2,1), known)
        self.assertNotIn((2,1), actual)

    def test_body_and_swept_collision(self):
        r = RestaurantMap(obstacles={(3,3)})
        self.assertFalse(body_clear((2.4,3), r))
        self.assertTrue(body_clear((2.2,3), r))
        self.assertFalse(segment_clear((1,3), (5,3), r))
        self.assertFalse(segment_clear((1,1), (5,1), r, [(3,1)]))
        self.assertFalse(body_clear((-.3,2), r))

    def test_declined_top_five_searches_further(self):
        s = self.make(escort=True)
        req = Requirements(party_size=4)
        first = rank_tables(s.restaurant, req)
        excluded = {p.key for p in first}
        further = rank_tables(s.restaurant, req, excluded)
        self.assertTrue(further)
        self.assertTrue(all(p.key not in excluded for p in further))

    def test_waiting_reevaluates_unseen_plans(self):
        s = Simulation()
        s.timer.stop()
        self.addCleanup(lambda: s.timer.stop())
        group = s.group
        group.requirements = Requirements(party_size=4)
        group.declined_plans.update(p.key for p in rank_tables(s.restaurant, group.requirements))
        s.group = None
        s.phase = IDLE
        s.waiting = [group]
        self.assertTrue(s._evaluate_waiting())
        self.assertNotIn(s.proposed.key, group.declined_plans)

    def test_customer_stop_immediate_and_resume(self):
        s = self.make(escort=True)
        s.step(.5)
        position = s.robot.visual_position
        customer = s.group.position
        s.set_customer_stopped(True)
        s.step(2)
        self.assertEqual(s.robot.visual_position, position)
        self.assertEqual(s.group.position, customer)
        self.assertIn('顧客', s.wait_reason)
        s.set_customer_stopped(False)
        s.step(1)
        self.assertNotEqual(s.robot.visual_position, position)

    def test_slow_customer_wait_and_hysteresis(self):
        s = self.make(escort=True)
        s.set_speed(1.5)
        s.set_customer_speed(.5)
        waited = False
        resumed = False
        for _ in range(400):
            s.step(.05)
            if s._waiting_customer: waited = True
            elif waited: resumed = True
            if s.group and s.robot.task == ESCORTING:
                self.assertLessEqual(trail_length(s.group.position, s.group.trail), 2.54)
        self.assertTrue(waited)
        self.assertTrue(resumed)

    def test_customer_never_cuts_table_corner(self):
        s = self.make(escort=True)
        for _ in range(500):
            s.step(.05)
            if s.group and s.group.position is not None:
                self.assertTrue(body_clear(s.group.position, s.restaurant))
                self.assertGreaterEqual(distance(s.robot.visual_position, s.group.position), .5-1e-7)
            if s.phase == IDLE: break
        self.assertEqual(s.phase, IDLE)

    def test_wait_for_customer_before_occupancy(self):
        s = self.make(escort=True)
        s.set_customer_speed(.5)
        observed = False
        for _ in range(1500):
            s.step(.02)
            if '等待顧客到達' in s.wait_reason:
                observed = True
                self.assertEqual(s.restaurant.table(s.group.allocations[0].table_name).status, RESERVED)
                break
        self.assertTrue(observed)
        s.step(30)
        self.assertEqual(s.phase, IDLE)
        self.assertTrue(any(t.status == OCCUPIED for t in s.restaurant.tables))

    def test_multi_table_complete_and_return(self):
        s = Simulation()
        s.timer.stop()
        self.addCleanup(lambda: s.timer.stop())
        s._received(ReceptionResult(Requirements(party_size=8), ''))
        s.confirm()
        names = [a.table_name for a in s.group.allocations]
        s.step(100)
        self.assertEqual(s.phase, IDLE)
        self.assertIsNone(s.group)
        self.assertEqual(s.robot.position, s.restaurant.robot_start)
        self.assertTrue(all(s.restaurant.table(n).status == OCCUPIED for n in names))

    def test_pause_freezes_pedestrians(self):
        s = self.make()
        self.assertTrue(s.add_pedestrian((8,8), (10,8)))
        before = s.pedestrians[0].position
        s.set_paused(True)
        s.step(2)
        self.assertEqual(s.pedestrians[0].position, before)
        s.set_paused(False)
        s.set_time_scale(2)
        s.step(.5)
        self.assertAlmostEqual(s.pedestrians[0].position[0], 9)
        s.step(1)
        self.assertFalse(s.pedestrians)

    def test_invalid_pedestrian_is_rejected(self):
        s = self.make()
        self.assertFalse(s.add_pedestrian((5,5), (8,5)))
        self.assertFalse(s.add_pedestrian((-1,5), (8,5)))
        self.assertFalse(s.add_pedestrian((8,8), (8,8)))
        self.assertFalse(s.pedestrians)

    def test_pedestrian_slowdown_stop_and_resume(self):
        s = self.make()
        p = Pedestrian(1, (6.8,5), [(6.8,6)], speed=0)
        s.pedestrians = [p]
        s.step(.25)
        self.assertAlmostEqual(s.robot.visual_position[0], 5.1)
        self.assertIn('減速', s.wait_reason)
        p.position = (6,5)
        before = s.robot.visual_position
        s.step(.25)
        self.assertEqual(s.robot.visual_position, before)
        self.assertIn('停止', s.wait_reason)
        s.clear_pedestrians()
        s.step(.5)
        self.assertGreater(s.robot.visual_position[0], before[0])

    def test_pedestrian_detour(self):
        s = self.make()
        s.pedestrians = [Pedestrian(1, (6,5), [(6,6)], speed=0)]
        for _ in range(300):
            s.step(.05)
            if s.pedestrians:
                self.assertGreaterEqual(distance(s.robot.visual_position, s.pedestrians[0].position), .5-1e-7)
            if s.phase == IDLE: break
        self.assertEqual(s.phase, IDLE)

    def test_pedestrian_does_not_walk_through_robot(self):
        s = self.make()
        s.set_customer_stopped(True)
        s.robot.route = []
        s.robot.goal = (12,5)
        self.assertTrue(s.add_pedestrian((7,5), (3,5)))
        s.step(5)
        self.assertGreaterEqual(distance(s.pedestrians[0].position, s.robot.visual_position), .5-1e-7)

    def test_static_block_assistance_and_recovery(self):
        s = self.make(escort=True)
        for cell in ((7,2), (9,2), (8,3), (8,1)):
            # Leave the customer's body untouched; block all exits via the surrounding corridors.
            if cell != (8,1): s.restaurant.obstacles.add(cell)
        s.restaurant.obstacles.add((7,1))
        s.restaurant.obstacles.add((9,1))
        s.restaurant.obstacles.add((8,0))
        s._map_changed()
        self.assertEqual(s.phase, BLOCKED)
        s.step(11)
        self.assertTrue(s._assistance_logged)
        self.assertTrue(all(s.restaurant.table(a.table_name).status == RESERVED for a in s.group.allocations))
        s.restaurant.obstacles.clear()
        s._map_changed()
        s.step(50)
        self.assertEqual(s.phase, IDLE)

    def test_obstacle_edit_protects_continuous_bodies(self):
        s = self.make()
        s.step(.7)
        s.toggle_obstacle((6,5))
        self.assertNotIn((6,5), s.restaurant.obstacles)
        self.assertTrue(body_clear(s.robot.visual_position, s.restaurant))

    def test_crossing_scenarios_no_body_overlap(self):
        for start, goal in [((4,4),(6,4)), ((6,8),(4,8)), ((7,3),(11,3)), ((6,3),(4,3))]:
            with self.subTest(start=start, goal=goal):
                s = self.make(escort=True)
                self.assertTrue(s.add_pedestrian(start, goal))
                for _ in range(2400):
                    s.step(.05)
                    actors = [s.robot.visual_position] + [p.position for p in s.pedestrians]
                    if s.customer_visual_position is not None:
                        actors.append(s.customer_visual_position)
                    for index, actor in enumerate(actors):
                        self.assertTrue(body_clear(actor, s.restaurant))
                        for other in actors[index+1:]:
                            self.assertGreaterEqual(distance(actor, other), .5-1e-7)
                    if s.phase == IDLE:
                        break
                self.assertEqual(s.phase, IDLE)

    def test_time_scale_preserves_complete_world_state(self):
        normal, fast = self.make(escort=True), self.make(escort=True)
        for s in (normal, fast):
            s.add_pedestrian((4,4), (6,4))
        fast.set_time_scale(4)
        normal.step(3)
        fast.step(.75)
        self.assertAlmostEqual(normal.simulated_time, fast.simulated_time)
        self.assertEqual(normal.robot.position, fast.robot.position)
        self.assertAlmostEqual(normal.robot.progress, fast.robot.progress)
        self.assertEqual(normal.group.position, fast.group.position)
        self.assertEqual([p.position for p in normal.pedestrians], [p.position for p in fast.pedestrians])

if __name__ == '__main__': unittest.main()
