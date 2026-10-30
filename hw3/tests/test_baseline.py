import unittest
from support import APP
from ai import ReceptionResult
from navigation import astar
from restaurant import Requirements, FREE, OCCUPIED, RESERVED, create_restaurant
from seating import rank_tables, capacity_problem
from simulation import Simulation, CONFIRMING, ESCORTING



class BaselineTests(unittest.TestCase):
    def test_map_capacity(self):
        r = create_restaurant()
        self.assertEqual(len(r.tables), 21)
        self.assertEqual(sum(t.capacity for t in r.tables), 98)

    def test_astar_avoids_tables_and_obstacles(self):
        r = create_restaurant()
        r.obstacles.add((8, 3))
        route = astar(r, r.robot_start, r.table('B1').goal)
        self.assertIsNotNone(route)
        self.assertFalse(set(route) & r.blocked_cells)
        self.assertTrue(all(abs(a[0]-b[0])+abs(a[1]-b[1]) == 1 for a,b in zip(route,route[1:])))

    def test_single_and_multi_table_capacity(self):
        for size in (1, 5, 8, 10, 98):
            with self.subTest(size=size):
                r = create_restaurant()
                plan = rank_tables(r, Requirements(party_size=size))[0]
                self.assertEqual(sum(a.people for a in plan.allocations), size)
                self.assertTrue(all(0 < a.people <= a.capacity for a in plan.allocations))

    def test_hard_window_and_no_split(self):
        r = create_restaurant()
        req = Requirements(party_size=8, window_preference=True, window_required=True)
        self.assertTrue(all(a.table_name.startswith('A') for a in rank_tables(r, req)[0].allocations))
        self.assertIsNotNone(capacity_problem(r, Requirements(party_size=8, allow_split=False)))
        self.assertIsNotNone(capacity_problem(r, Requirements(party_size=99)))

    def test_reserve_atomically_and_revalidate(self):
        s = Simulation()
        self.addCleanup(lambda: s.timer.stop())
        s.timer.stop()
        s._received(ReceptionResult(Requirements(party_size=8), ''))
        self.assertEqual(s.phase, CONFIRMING)
        names = s.proposed.table_names
        self.assertTrue(all(s.restaurant.table(n).status == FREE for n in names))
        s.confirm()
        self.assertEqual(s.phase, ESCORTING)
        self.assertTrue(all(s.restaurant.table(n).status == RESERVED for n in names))
        s.release_table(names[0])
        self.assertEqual(s.restaurant.table(names[0]).status, RESERVED)

    def test_changed_plan_never_partially_reserves(self):
        s = Simulation()
        s.timer.stop()
        self.addCleanup(lambda: s.timer.stop())
        s._received(ReceptionResult(Requirements(party_size=8), ''))
        original = s.proposed.table_names
        s.restaurant.table(original[-1]).status = OCCUPIED
        s.confirm()
        self.assertFalse(any(t.status == RESERVED for t in s.restaurant.tables))
        self.assertNotEqual(s.phase, ESCORTING)

if __name__ == '__main__':
    unittest.main()
