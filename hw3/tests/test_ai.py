import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from support import APP
from ai import parse_result, RequestThread
from restaurant import Requirements
from dataclasses import asdict


def content(**changes):
    data = asdict(Requirements(party_size=4)) | {'reply': ''}
    data.update(changes)
    return json.dumps(data, ensure_ascii=False)


def response(value):
    return io.BytesIO(json.dumps({'message': {'content': value}}).encode())


class AITests(unittest.TestCase):
    def test_valid_and_markdown_json(self):
        for text in (content(), '```json\n'+content()+'\n```'):
            self.assertTrue(parse_result(text).requirements.ready)

    def test_missing_party_requires_question(self):
        result = parse_result(content(party_size=None))
        self.assertFalse(result.requirements.ready)
        self.assertTrue(result.reply)

    def test_optional_courtesy_question_does_not_block(self):
        self.assertTrue(parse_result(content(question='需要靠窗嗎？')).requirements.ready)

    def test_unsupported_condition_is_preserved(self):
        result = parse_result(content(other_requirements=['輪椅通道']))
        self.assertFalse(result.requirements.ready)
        self.assertEqual(result.requirements.other_requirements, ['輪椅通道'])
        self.assertTrue(result.reply)

    def test_malformed_fields_rejected(self):
        invalid = [dict(party_size=True), dict(party_size=0), dict(window_preference='true'),
                   dict(table_name='A8'), dict(table_required=True), dict(window_required=True),
                   dict(allow_split='false'), dict(other_requirements=['']), dict(question=3)]
        for values in invalid:
            with self.subTest(values=values), self.assertRaises(ValueError):
                parse_result(content(**values))
        for text in ('[]', '{}', 'not JSON'):
            with self.subTest(text=text), self.assertRaises(ValueError): parse_result(text)

    def request(self):
        return RequestThread('http://localhost:11434', 'test-model', [], None)

    def test_success(self):
        worker = self.request()
        with patch('ai.urlopen', return_value=response(content())):
            worker.run()
        self.assertIsNotNone(worker.result)
        self.assertFalse(worker.error)

    def test_invalid_json_retry_then_success(self):
        worker = self.request()
        with patch('ai.urlopen', side_effect=[response('bad'), response(content())]) as send:
            worker.run()
        self.assertEqual(send.call_count, 2)
        self.assertIsNotNone(worker.result)

    def test_invalid_json_twice_reports_failure(self):
        worker = self.request()
        with patch('ai.urlopen', side_effect=[response('bad'), response('bad')]):
            worker.run()
        self.assertIsNone(worker.result)
        self.assertIn('兩次', worker.error)

    def test_network_errors(self):
        errors = [TimeoutError('timeout'), URLError('offline'),
                  HTTPError('http://localhost', 503, 'unavailable', {}, io.BytesIO(b'busy'))]
        for error in errors:
            with self.subTest(error=type(error).__name__):
                worker = self.request()
                with patch('ai.urlopen', side_effect=error): worker.run()
                self.assertIsNone(worker.result)
                self.assertTrue(worker.error)

    def test_malformed_ollama_envelope(self):
        worker = self.request()
        with patch('ai.urlopen', return_value=io.BytesIO(b'[]')): worker.run()
        self.assertIn('格式', worker.error)

if __name__ == '__main__': unittest.main()
