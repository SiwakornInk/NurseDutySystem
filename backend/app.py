from flask import Flask, request, jsonify
from flask_cors import CORS
from solver import ScheduleSolver
from config import Config
import firebase_admin
from firebase_admin import credentials, firestore
import os
import traceback

app = Flask(__name__)
CORS(app)
config = Config()

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate('serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
        print("Firebase Admin SDK initialized successfully")
    
    db = firestore.client()
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    db = None

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'nurse-scheduler-backend'})

@app.route('/generate-schedule', methods=['POST'])
def generate_schedule():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['nurses', 'wardId', 'startDate', 'endDate', 'requiredNurses']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        if not data['nurses']:
            return jsonify({'error': 'No nurses provided'}), 400
        
        solver = ScheduleSolver()
        result = solver.solve_schedule(data)
        
        if 'error' in result:
            return jsonify(result), 400
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"Error in generate_schedule: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/validate-swap', methods=['POST'])
def validate_swap():
    try:
        data = request.get_json()
        
        required_fields = ['fromNurseId', 'toNurseId', 'fromDate', 'toDate', 'fromShift', 'toShift']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing field: {field}'}), 400
        
        from_shift = data['fromShift']
        to_shift = data['toShift']
        
        if from_shift == 0 and to_shift == 0:
            return jsonify({'valid': False, 'reason': 'ไม่สามารถแลกวันหยุดกับวันหยุดได้'})
        
        if from_shift != 0 and to_shift != 0 and from_shift != to_shift:
            return jsonify({'valid': False, 'reason': 'ต้องแลกเวรประเภทเดียวกันเท่านั้น'})
        
        return jsonify({'valid': True})
        
    except Exception as e:
        print(f"Error in validate_swap: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/statistics/<ward_id>/<month>', methods=['GET'])
def get_statistics(ward_id, month):
    try:
        if not db:
            return jsonify({'error': 'Database not initialized'}), 500
        
        schedules_ref = db.collection('schedules')
        query = schedules_ref.where('wardId', '==', ward_id).where('month', '==', month).limit(1)
        docs = query.stream()
        
        schedule_doc = None
        for doc in docs:
            schedule_doc = doc.to_dict()
            break
        
        if not schedule_doc:
            return jsonify({'error': 'Schedule not found'}), 404
        
        stats = schedule_doc.get('statistics', {})
        
        summary = {
            'total_nurses': len(stats),
            'avg_shifts': sum(s['total'] for s in stats.values()) / len(stats) if stats else 0,
            'avg_off_days': sum(s['off'] for s in stats.values()) / len(stats) if stats else 0,
            'total_overtime': sum(s['overtime'] for s in stats.values()),
            'by_nurse': stats
        }
        
        return jsonify(summary), 200
        
    except Exception as e:
        print(f"Error in get_statistics: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=config.PORT, debug=config.DEBUG)