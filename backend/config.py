import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    FLASK_ENV = os.environ.get('FLASK_ENV') or 'development'
    DEBUG = FLASK_ENV == 'development'
    PORT = int(os.environ.get('PORT', 5000))
    
    MAX_CONSECUTIVE_SHIFTS = 6
    MAX_CONSECUTIVE_SAME_SHIFT = 2
    MAX_CONSECUTIVE_OFF_DAYS = 2
    MIN_OFF_DAYS_IN_WINDOW = 2
    WINDOW_SIZE_FOR_MIN_OFF = 7
    
    PENALTY_OFF_DAY_UNDER_TARGET = 50
    PENALTY_ENDING_MONTH_AT_MAX_CONSECUTIVE = 35
    PENALTY_TOTAL_SHIFT_IMBALANCE = 30
    PENALTY_OFF_DAY_IMBALANCE = 30
    PENALTY_SHIFT_TYPE_IMBALANCE = 15
    PENALTY_PER_NA_DOUBLE = 10
    PENALTY_NIGHT_TO_MORNING_TRANSITION = 5
    PENALTY_BASE_SOFT_VIOLATION = 15
    BONUS_HIGH_PRIORITY = 15
    BONUS_CARRY_OVER = 5
    
    SHIFT_MORNING = 1
    SHIFT_AFTERNOON = 2
    SHIFT_NIGHT = 3
    SHIFTS = [SHIFT_MORNING, SHIFT_AFTERNOON, SHIFT_NIGHT]
    
    SHIFT_NAMES_TH = {
        SHIFT_MORNING: 'ช',
        SHIFT_AFTERNOON: 'บ',
        SHIFT_NIGHT: 'ด',
        0: 'หยุด'
    }
    
    SHIFT_NAMES_EN = {
        SHIFT_MORNING: 'Morning',
        SHIFT_AFTERNOON: 'Afternoon',
        SHIFT_NIGHT: 'Night',
        0: 'Off'
    }