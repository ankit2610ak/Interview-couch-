import os
import sys
from typing import Any, Dict, List
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import app


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient fixture with raise_server_exceptions=False to test error responses."""
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def sample_conversation_history() -> List[Dict[str, str]]:
    """Sample realistic technical interview transcript history."""
    return [
        {
            "role": "assistant",
            "content": "What is the difference between a list and a tuple in Python?",
        },
        {
            "role": "user",
            "content": "Lists are mutable sequences, whereas tuples are immutable. Tuples can also be hashable if all their items are hashable.",
        },
        {
            "role": "assistant",
            "content": "Good explanation. How does Python implement dictionary lookups internally?",
        },
        {
            "role": "user",
            "content": "Python dictionaries are implemented using open-addressing hash tables with quadratic/pseudo-random probing.",
        },
    ]


@pytest.fixture
def sample_report_payload() -> Dict[str, Any]:
    """Sample valid structured interview report."""
    return {
        "score": 85,
        "strengths": "Demonstrated solid understanding of mutability and internal hash table structure in Python. Answers were precise and technical.",
        "weaknesses": "Could provide more real-world examples of when tuple immutability is preferred in system architectures.",
        "revision_areas": "Memory optimization, collision resolution strategies, Python internal C structs",
        "verdict": "Candidate demonstrated strong foundational and applied knowledge in Python data structures.",
        "recommendation": "Pass",
    }
