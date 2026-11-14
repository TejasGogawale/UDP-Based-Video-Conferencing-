from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from database import db
from models.user import User
import re

auth_bp = Blueprint('auth', __name__)

EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


def validate_email(email):
    return EMAIL_PATTERN.match(email) is not None


def validate_password(password):
    return isinstance(password, str) and 6 <= len(password) <= 128


def find_user_by_email(email):
    # Case-insensitive so accounts created before emails were normalised still match.
    return User.query.filter(db.func.lower(User.email) == email.lower()).first()


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name') or '').strip()
    email = str(data.get('email') or '').strip().lower()
    password = data.get('password')

    if not name or not email or not password:
        return jsonify({'error': 'Missing required fields'}), 400

    if len(name) > 255:
        return jsonify({'error': 'Name is too long'}), 400

    if not validate_email(email):
        return jsonify({'error': 'Invalid email format'}), 400

    if not validate_password(password):
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if find_user_by_email(email):
        return jsonify({'error': 'Email already registered'}), 409

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Email already registered'}), 409

    access_token = create_access_token(identity=user.id)
    return jsonify({
        'message': 'User registered successfully',
        'token': access_token,
        'user': user.to_dict()
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get('email') or '').strip()
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Missing email or password'}), 400

    user = find_user_by_email(email)

    if not user or not user.check_password(str(password)):
        return jsonify({'error': 'Invalid email or password'}), 401

    access_token = create_access_token(identity=user.id)
    return jsonify({
        'message': 'Login successful',
        'token': access_token,
        'user': user.to_dict()
    }), 200


@auth_bp.route('/verify', methods=['GET'])
@jwt_required()
def verify():
    user = db.session.get(User, get_jwt_identity())

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({'user': user.to_dict()}), 200


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user = db.session.get(User, get_jwt_identity())
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    name = str(data.get('name') or '').strip()
    if not name or len(name) > 255:
        return jsonify({'error': 'Enter a name up to 255 characters'}), 400

    user.name = name
    db.session.commit()
    return jsonify({'user': user.to_dict()}), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({'message': 'Logged out successfully'}), 200
