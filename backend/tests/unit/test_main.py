import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app, lifespan


class TestMainApp:
    def test_health_check_endpoint(self, client: TestClient):
        """GET / returns status 200 and healthy message."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "AI Interview Coach API" in data["message"]

    @pytest.mark.asyncio
    async def test_startup_message_printed(self, capsys):
        """Verify lifespan prints 'AI Interview Coach API started successfully'."""
        async with lifespan(app):
            pass
        captured = capsys.readouterr()
        assert "AI Interview Coach API started successfully" in captured.out

    def test_unhandled_exception_handler(self, client: TestClient):
        """Verify unhandled exceptions return a user-friendly JSON response instead of a raw traceback."""
        with patch(
            "routers.interview.get_next_interviewer_message",
            side_effect=RuntimeError("Groq service disconnected"),
        ):
            response = client.post(
                "/api/interview/start",
                json={"topic": "Python", "difficulty": "Easy"},
            )
            assert response.status_code == 500
            data = response.json()
            assert data["error"] == "Internal Server Error"
            assert "An unexpected error occurred" in data["message"]
            assert "Groq service disconnected" in data["detail"]

    def test_cors_headers_allowed(self, client: TestClient):
        """Verify CORS middleware permits cross-origin requests from frontend."""
        response = client.get(
            "/",
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "*" or \
               response.headers.get("access-control-allow-origin") == "http://localhost:3000"

    def test_cors_preflight_options(self, client: TestClient):
        """Verify CORS preflight OPTIONS request succeeds."""
        response = client.options(
            "/api/interview/start",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers

    def test_registered_routes_exist(self):
        """Verify all required API route paths are registered in the FastAPI app."""
        routes = [route.path for route in app.routes]
        assert "/api/interview/start" in routes
        assert "/api/interview/answer" in routes
        assert "/api/report/generate" in routes
        assert "/" in routes
        assert "/openapi.json" in routes
        assert "/docs" in routes

    def test_openapi_schema_endpoint(self, client: TestClient):
        """Verify OpenAPI schema renders properly."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert schema["info"]["title"] == "AI Interview Coach API"
        assert "/api/interview/start" in schema["paths"]
        assert "/api/interview/answer" in schema["paths"]
        assert "/api/report/generate" in schema["paths"]
