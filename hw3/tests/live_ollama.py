"""Explicit opt-in integration suite: python tests/live_ollama.py.
Only synthetic restaurant requests are sent to the configured Ollama model.
"""
import json
from pathlib import Path
import sys
import time
import unittest
from dataclasses import asdict
from datetime import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from support import APP
from PySide6.QtTest import QTest
import ai
from ai import DEFAULT_MODEL, DEFAULT_URL
from restaurant import OCCUPIED
from simulation import Simulation, IDLE

RECORDS = []
SCENARIOS = {
    'ordinary': [('我們五位', {'party_size':5, 'window_preference':None, 'ready':True})],
    'window': [('我們四位，希望靠窗', {'party_size':4, 'window_preference':True, 'window_required':False, 'ready':True})],
    'multi_table': [('我們八位', {'party_size':8, 'ready':True})],
    'no_split': [('我們八位，不要分桌', {'party_size':8, 'allow_split':False, 'ready':True})],
    'clarification': [('希望靠窗', {'party_size':None, 'window_preference':True, 'ready':False}),
                      ('我們四位', {'party_size':4, 'window_preference':True, 'ready':True})],
    'change_requirements': [('我們五位，希望靠窗', {'party_size':5, 'window_preference':True}),
                            ('改成八位，不要靠窗，一定要包含B2桌，可以分桌',
                             {'party_size':8, 'window_preference':False, 'table_name':'B2', 'table_required':True,
                              'allow_split':True, 'ready':True})],
}

class OllamaIntegrationTests(unittest.TestCase):
    def scenario(self, name, repetition):
        s = Simulation()
        s.timer.stop()
        def cleanup():
            s.timer.stop()
            if s.ai.worker is not None:
                s.ai.worker.wait(250000)
                APP.processEvents()
        self.addCleanup(cleanup)
        for text, expected in SCENARIOS[name]:
            raw = []
            original = ai.parse_result
            def capture(value):
                raw.append(value)
                return original(value)
            record = {'scenario': name, 'repetition':repetition, 'input':text, 'expected':expected,
                      'raw_responses':raw, 'model':DEFAULT_MODEL}
            RECORDS.append(record)
            with patch('ai.parse_result', side_effect=capture):
                s.submit(text, DEFAULT_URL, DEFAULT_MODEL)
                deadline = time.monotonic()+250
                while s.ai.busy and time.monotonic() < deadline:
                    QTest.qWait(20)
                self.assertFalse(s.ai.busy, 'Ollama request exceeded integration deadline')
            record['error'] = s.last_error
            record['actual'] = asdict(s.group.requirements)
            self.assertFalse(s.last_error, s.last_error)
            for key, value in expected.items():
                self.assertEqual(getattr(s.group.requirements, key), value, f'{name}: {key}')
            record['passed'] = True
        if name == 'no_split':
            self.assertIsNone(s.proposed)
            self.assertFalse(s.can_wait)
        else:
            if s.alternatives:
                s.choose_alternative(s.alternatives[0].key)
            self.assertIsNotNone(s.proposed)
            s.confirm()
            names = [a.table_name for a in s.group.allocations]
            s.step(200)
            self.assertEqual(s.phase, IDLE)
            self.assertTrue(all(s.restaurant.table(n).status == OCCUPIED for n in names))

for name in SCENARIOS:
    for repetition in range(1,4):
        def run(self, n=name, r=repetition): self.scenario(n,r)
        setattr(OllamaIntegrationTests, f'test_{name}_{repetition}', run)

if __name__ == '__main__':
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(OllamaIntegrationTests))
    output = Path(__file__).with_name('ollama-results.json')
    payload = json.dumps({'model':DEFAULT_MODEL, 'base_url':DEFAULT_URL, 'tests_run':result.testsRun,
                          'failures':len(result.failures), 'errors':len(result.errors), 'records':RECORDS},
                         ensure_ascii=False, indent=2)
    output.write_text(payload)
    history = output.parent / 'runs'
    history.mkdir(exist_ok=True)
    stamp = datetime.now(ZoneInfo('Asia/Taipei')).strftime('%Y%m%d-%H%M%S-%f')
    (history / f'ollama-{stamp}.json').write_text(payload)
    sys.exit(not result.wasSuccessful())
