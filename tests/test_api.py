import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from web.server import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_index(client):
    response = client.get('/')
    assert response.status_code == 200

def test_about(client):
    response = client.get('/about')
    assert response.status_code == 200

def test_training_dashboard(client):
    response = client.get('/training')
    assert response.status_code == 200
