import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import create_app
from app.extensions import db

app = create_app()
with app.app_context():
    db.create_all()
    print("Done - tables created")
