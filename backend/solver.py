from ortools.sat.python import cp_model
import datetime
from config import Config

class ScheduleSolver:
    def __init__(self):
        self.config = Config()
        
    def solve_schedule(self, data):
        nurses = data['nurses']
        ward_id = data['wardId']
        start_date = datetime.date.fromisoformat(data['startDate'])
        end_date = datetime.date.fromisoformat(data['endDate'])
        required_nurses = data['requiredNurses']
        target_off_days = data.get('targetOffDays', 8)
        solver_time_limit = data.get('solverTimeLimit', 120)
        previous_schedule = data.get('previousSchedule')
        monthly_requests = data.get('monthlyRequests', {})
        hard_requests = data.get('hardRequests', [])
        carry_over_flags = data.get('carryOverFlags', {})
        
        days = []
        current = start_date
        while current <= end_date:
            days.append(current)
            current += datetime.timedelta(days=1)
        
        num_nurses = len(nurses)
        num_days = len(days)
        
        if num_nurses == 0 or num_days == 0:
            return {'error': 'ไม่มีพยาบาลหรือวันที่ในการจัดตาราง'}
        
        model = cp_model.CpModel()
        
        shifts = {}
        for n in range(num_nurses):
            for d in range(num_days):
                for s in self.config.SHIFTS:
                    shifts[(n, d, s)] = model.NewBoolVar(f'shift_n{n}_d{d}_s{s}')
        
        is_off = {}
        is_working = {}
        for n in range(num_nurses):
            for d in range(num_days):
                is_off[(n, d)] = model.NewBoolVar(f'off_n{n}_d{d}')
                is_working[(n, d)] = is_off[(n, d)].Not()
        
        num_shifts_on_day = {}
        for n in range(num_nurses):
            for d in range(num_days):
                num_shifts_on_day[n, d] = model.NewIntVar(0, 2, f'nshifts_n{n}_d{d}')
                model.Add(num_shifts_on_day[n, d] == sum(shifts[(n, d, s)] for s in self.config.SHIFTS))
                model.Add(num_shifts_on_day[n, d] >= 1).OnlyEnforceIf(is_working[(n, d)])
                model.Add(num_shifts_on_day[n, d] == 0).OnlyEnforceIf(is_off[(n, d)])
        
        for n in range(num_nurses):
            for d in range(num_days):
                model.Add(shifts[(n, d, self.config.SHIFT_MORNING)] + shifts[(n, d, self.config.SHIFT_AFTERNOON)] <= 1)
                model.Add(shifts[(n, d, self.config.SHIFT_MORNING)] + shifts[(n, d, self.config.SHIFT_NIGHT)] <= 1)
        
        for d in range(num_days):
            for s in self.config.SHIFTS:
                req = required_nurses.get(str(s), 0)
                model.Add(sum(shifts[(n, d, s)] for n in range(num_nurses)) == req)
        
        self._apply_hard_requests(model, shifts, is_off, hard_requests, nurses, days)
        
        penalty_terms = []
        self._apply_consecutive_constraints(model, shifts, is_off, is_working, num_shifts_on_day, 
                                           nurses, days, previous_schedule, penalty_terms)
        
        self._apply_soft_requests(model, shifts, is_off, is_working, monthly_requests, 
                                 nurses, days, carry_over_flags, penalty_terms)
        
        self._apply_fairness_objectives(model, shifts, is_off, num_shifts_on_day, 
                                       nurses, days, target_off_days, penalty_terms)
        
        if penalty_terms:
            model.Minimize(sum(penalty * var for penalty, var in penalty_terms))
        
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = solver_time_limit
        solver.parameters.num_workers = 4
        
        status = solver.Solve(model)
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            return self._extract_solution(solver, shifts, nurses, days, ward_id, status)
        else:
            return {'error': f'ไม่สามารถหาคำตอบได้ (Status: {solver.StatusName(status)})'}
    
    def _apply_hard_requests(self, model, shifts, is_off, hard_requests, nurses, days):
        nurse_id_to_index = {nurse['id']: i for i, nurse in enumerate(nurses)}
        
        for request in hard_requests:
            if request['nurseId'] in nurse_id_to_index:
                n = nurse_id_to_index[request['nurseId']]
                request_date = datetime.date.fromisoformat(request['date'])
                
                d = None
                for i, day in enumerate(days):
                    if day == request_date:
                        d = i
                        break
                
                if d is not None:
                    model.Add(is_off[(n, d)] == 1)
                    for s in self.config.SHIFTS:
                        model.Add(shifts[(n, d, s)] == 0)
    
    def _apply_consecutive_constraints(self, model, shifts, is_off, is_working, num_shifts_on_day,
                                      nurses, days, previous_schedule, penalty_terms):
        nm_transition_penalties = []
        
        for n in range(len(nurses)):
            if previous_schedule and nurses[n]['id'] in previous_schedule.get('lastDayShifts', {}):
                last_shifts = previous_schedule['lastDayShifts'][nurses[n]['id']]
                
                if self.config.SHIFT_AFTERNOON in last_shifts:
                    model.Add(shifts[(n, 0, self.config.SHIFT_NIGHT)] == 0)
                
                if self.config.SHIFT_NIGHT in last_shifts and self.config.SHIFT_AFTERNOON in last_shifts:
                    model.Add(shifts[(n, 0, self.config.SHIFT_NIGHT)] == 0)
                    if self.config.PENALTY_NIGHT_TO_MORNING_TRANSITION > 0:
                        nm_transition_penalties.append(shifts[(n, 0, self.config.SHIFT_MORNING)])
            
            if len(days) > 1:
                for d in range(len(days) - 1):
                    model.Add(shifts[(n, d, self.config.SHIFT_AFTERNOON)] + 
                             shifts[(n, d + 1, self.config.SHIFT_NIGHT)] <= 1)
                    
                    na_double = model.NewBoolVar(f'na_double_n{n}_d{d}')
                    model.AddMultiplicationEquality(na_double, 
                        [shifts[(n, d, self.config.SHIFT_NIGHT)], shifts[(n, d, self.config.SHIFT_AFTERNOON)]])
                    model.AddImplication(na_double, shifts[(n, d + 1, self.config.SHIFT_NIGHT)].Not())
                    
                    if self.config.PENALTY_NIGHT_TO_MORNING_TRANSITION > 0:
                        nm_indicator = model.NewBoolVar(f'nm_trans_n{n}_d{d}')
                        model.AddBoolAnd([na_double, shifts[(n, d + 1, self.config.SHIFT_MORNING)]]).OnlyEnforceIf(nm_indicator)
                        model.AddImplication(nm_indicator, na_double)
                        model.AddImplication(nm_indicator, shifts[(n, d + 1, self.config.SHIFT_MORNING)])
                        nm_transition_penalties.append(nm_indicator)
            
            consecutive_shift_count = {}
            for d in range(len(days)):
                consecutive_shift_count[n, d] = model.NewIntVar(0, self.config.MAX_CONSECUTIVE_SHIFTS, 
                                                               f'consec_n{n}_d{d}')
            
            if previous_schedule and nurses[n]['id'] in previous_schedule.get('consecutiveShifts', {}):
                prev_consecutive = previous_schedule['consecutiveShifts'][nurses[n]['id']]
                model.Add(consecutive_shift_count[n, 0] == 0).OnlyEnforceIf(is_off[n, 0])
                model.Add(consecutive_shift_count[n, 0] == prev_consecutive + num_shifts_on_day[n, 0]).OnlyEnforceIf(is_working[n, 0])
            else:
                model.Add(consecutive_shift_count[n, 0] == 0).OnlyEnforceIf(is_off[n, 0])
                model.Add(consecutive_shift_count[n, 0] == num_shifts_on_day[n, 0]).OnlyEnforceIf(is_working[n, 0])
            
            model.Add(consecutive_shift_count[n, 0] <= self.config.MAX_CONSECUTIVE_SHIFTS)
            
            for d in range(1, len(days)):
                model.Add(consecutive_shift_count[n, d] == 0).OnlyEnforceIf(is_off[n, d])
                model.Add(consecutive_shift_count[n, d] == num_shifts_on_day[n, d]).OnlyEnforceIf(is_working[n, d]).OnlyEnforceIf(is_off[n, d-1])
                model.Add(consecutive_shift_count[n, d] == consecutive_shift_count[n, d-1] + num_shifts_on_day[n, d]).OnlyEnforceIf(is_working[n, d]).OnlyEnforceIf(is_working[n, d-1])
                model.Add(consecutive_shift_count[n, d] <= self.config.MAX_CONSECUTIVE_SHIFTS)
            
            if self.config.MAX_CONSECUTIVE_SAME_SHIFT > 0:
                for s in self.config.SHIFTS:
                    for d_start in range(len(days) - self.config.MAX_CONSECUTIVE_SAME_SHIFT):
                        model.Add(sum(shifts[(n, d_start + k, s)] for k in range(self.config.MAX_CONSECUTIVE_SAME_SHIFT + 1)) 
                                 <= self.config.MAX_CONSECUTIVE_SAME_SHIFT)
            
            if self.config.MAX_CONSECUTIVE_OFF_DAYS > 0:
                for d_start in range(len(days) - self.config.MAX_CONSECUTIVE_OFF_DAYS):
                    model.Add(sum(is_off[(n, d_start + k)] for k in range(self.config.MAX_CONSECUTIVE_OFF_DAYS + 1)) 
                             <= self.config.MAX_CONSECUTIVE_OFF_DAYS)
        
        if nm_transition_penalties and self.config.PENALTY_NIGHT_TO_MORNING_TRANSITION > 0:
            penalty_terms.append((self.config.PENALTY_NIGHT_TO_MORNING_TRANSITION, sum(nm_transition_penalties)))
    
    def _apply_soft_requests(self, model, shifts, is_off, is_working, monthly_requests,
                            nurses, days, carry_over_flags, penalty_terms):
        nurse_id_to_index = {nurse['id']: i for i, nurse in enumerate(nurses)}
        
        for nurse_id, requests in monthly_requests.items():
            if nurse_id not in nurse_id_to_index:
                continue
            
            n = nurse_id_to_index[nurse_id]
            
            for req in requests:
                if not req.get('type'):
                    continue
                
                penalty_weight = self.config.PENALTY_BASE_SOFT_VIOLATION
                if req.get('is_high_priority'):
                    penalty_weight += self.config.BONUS_HIGH_PRIORITY
                    if carry_over_flags.get(nurse_id):
                        penalty_weight += self.config.BONUS_CARRY_OVER
                
                violation_vars = []
                
                if req['type'] == 'no_specific_days':
                    specific_days = req.get('value', [])
                    for day_num in specific_days:
                        for d, day in enumerate(days):
                            if day.day == day_num:
                                violation_vars.append(is_working[(n, d)])
                
                elif req['type'] == 'request_specific_shifts':
                    shift_requests = req.get('value', [])
                    for shift_req in shift_requests:
                        day_num = shift_req.get('day')
                        shift_type = shift_req.get('shift_type')
                        
                        for d, day in enumerate(days):
                            if day.day == day_num and shift_type in self.config.SHIFTS:
                                not_met = model.NewBoolVar(f'req_not_met_n{n}_d{d}_s{shift_type}')
                                model.Add(shifts[(n, d, shift_type)] == 0).OnlyEnforceIf(not_met)
                                model.Add(shifts[(n, d, shift_type)] == 1).OnlyEnforceIf(not_met.Not())
                                violation_vars.append(not_met)
                
                elif req['type'] in ['no_morning_shifts', 'no_afternoon_shifts', 'no_night_shifts']:
                    shift_map = {
                        'no_morning_shifts': self.config.SHIFT_MORNING,
                        'no_afternoon_shifts': self.config.SHIFT_AFTERNOON,
                        'no_night_shifts': self.config.SHIFT_NIGHT
                    }
                    shift_type = shift_map[req['type']]
                    for d in range(len(days)):
                        violation_vars.append(shifts[(n, d, shift_type)])
                
                elif req['type'] == 'no_night_afternoon_double':
                    for d in range(len(days)):
                        na_double = model.NewBoolVar(f'na_req_n{n}_d{d}')
                        model.AddMultiplicationEquality(na_double,
                            [shifts[(n, d, self.config.SHIFT_NIGHT)], shifts[(n, d, self.config.SHIFT_AFTERNOON)]])
                        violation_vars.append(na_double)
                
                if violation_vars:
                    for var in violation_vars:
                        penalty_terms.append((penalty_weight, var))
    
    def _apply_fairness_objectives(self, model, shifts, is_off, num_shifts_on_day,
                                   nurses, days, target_off_days, penalty_terms):
        total_off = []
        total_shifts = []
        total_m = []
        total_a = []
        total_n = []
        
        for n in range(len(nurses)):
            off_var = model.NewIntVar(0, len(days), f'total_off_n{n}')
            shifts_var = model.NewIntVar(0, len(days) * 2, f'total_shifts_n{n}')
            m_var = model.NewIntVar(0, len(days), f'total_m_n{n}')
            a_var = model.NewIntVar(0, len(days), f'total_a_n{n}')
            n_var = model.NewIntVar(0, len(days), f'total_n_n{n}')
            
            model.Add(off_var == sum(is_off[(n, d)] for d in range(len(days))))
            model.Add(shifts_var == sum(num_shifts_on_day[n, d] for d in range(len(days))))
            model.Add(m_var == sum(shifts[(n, d, self.config.SHIFT_MORNING)] for d in range(len(days))))
            model.Add(a_var == sum(shifts[(n, d, self.config.SHIFT_AFTERNOON)] for d in range(len(days))))
            model.Add(n_var == sum(shifts[(n, d, self.config.SHIFT_NIGHT)] for d in range(len(days))))
            
            total_off.append(off_var)
            total_shifts.append(shifts_var)
            total_m.append(m_var)
            total_a.append(a_var)
            total_n.append(n_var)
        
        if target_off_days >= 0 and self.config.PENALTY_OFF_DAY_UNDER_TARGET > 0:
            off_under = []
            for n in range(len(nurses)):
                under_var = model.NewIntVar(0, len(days), f'off_under_n{n}')
                model.Add(under_var >= target_off_days - total_off[n])
                model.Add(under_var >= 0)
                off_under.append(under_var)
            
            total_under = model.NewIntVar(0, len(nurses) * len(days), 'total_under')
            model.Add(total_under == sum(off_under))
            penalty_terms.append((self.config.PENALTY_OFF_DAY_UNDER_TARGET, total_under))
        
        if len(nurses) > 1:
            if self.config.PENALTY_OFF_DAY_IMBALANCE > 0:
                min_off = model.NewIntVar(0, len(days), 'min_off')
                max_off = model.NewIntVar(0, len(days), 'max_off')
                model.AddMinEquality(min_off, total_off)
                model.AddMaxEquality(max_off, total_off)
                penalty_terms.append((self.config.PENALTY_OFF_DAY_IMBALANCE, max_off - min_off))
            
            if self.config.PENALTY_TOTAL_SHIFT_IMBALANCE > 0:
                min_shifts = model.NewIntVar(0, len(days) * 2, 'min_shifts')
                max_shifts = model.NewIntVar(0, len(days) * 2, 'max_shifts')
                model.AddMinEquality(min_shifts, total_shifts)
                model.AddMaxEquality(max_shifts, total_shifts)
                penalty_terms.append((self.config.PENALTY_TOTAL_SHIFT_IMBALANCE, max_shifts - min_shifts))
            
            if self.config.PENALTY_SHIFT_TYPE_IMBALANCE > 0:
                for shift_list, name in [(total_m, 'm'), (total_a, 'a'), (total_n, 'n')]:
                    min_s = model.NewIntVar(0, len(days), f'min_{name}')
                    max_s = model.NewIntVar(0, len(days), f'max_{name}')
                    model.AddMinEquality(min_s, shift_list)
                    model.AddMaxEquality(max_s, shift_list)
                    penalty_terms.append((self.config.PENALTY_SHIFT_TYPE_IMBALANCE, max_s - min_s))
        
        if self.config.PENALTY_PER_NA_DOUBLE > 0:
            na_doubles = []
            for n in range(len(nurses)):
                for d in range(len(days)):
                    na_var = model.NewBoolVar(f'na_double_obj_n{n}_d{d}')
                    model.AddMultiplicationEquality(na_var,
                        [shifts[(n, d, self.config.SHIFT_NIGHT)], shifts[(n, d, self.config.SHIFT_AFTERNOON)]])
                    na_doubles.append(na_var)
            
            if na_doubles:
                penalty_terms.append((self.config.PENALTY_PER_NA_DOUBLE, sum(na_doubles)))
    
    def _extract_solution(self, solver, shifts, nurses, days, ward_id, status):
        schedule_data = {
            'wardId': ward_id,
            'month': days[0].strftime('%Y-%m'),
            'shifts': {},
            'statistics': {},
            'solverStatus': solver.StatusName(status),
            'objectiveValue': solver.ObjectiveValue() if hasattr(solver, 'ObjectiveValue') else 0
        }
        
        for n, nurse in enumerate(nurses):
            nurse_id = nurse['id']
            schedule_data['shifts'][nurse_id] = {}
            stats = {'morning': 0, 'afternoon': 0, 'night': 0, 'total': 0, 'off': 0, 'overtime': 0}
            
            for d, day in enumerate(days):
                day_str = day.isoformat()
                day_shifts = []
                
                for s in self.config.SHIFTS:
                    if solver.Value(shifts[(n, d, s)]) == 1:
                        day_shifts.append(s)
                        if s == self.config.SHIFT_MORNING:
                            stats['morning'] += 1
                        elif s == self.config.SHIFT_AFTERNOON:
                            stats['afternoon'] += 1
                        elif s == self.config.SHIFT_NIGHT:
                            stats['night'] += 1
                        stats['total'] += 1
                
                if not day_shifts:
                    stats['off'] += 1
                elif len(day_shifts) > 1:
                    stats['overtime'] += len(day_shifts) - 1
                
                schedule_data['shifts'][nurse_id][day_str] = day_shifts
            
            schedule_data['statistics'][nurse_id] = stats
        
        schedule_data['nextCarryOverFlags'] = self._calculate_carry_over_flags(
            solver, shifts, nurses, days
        )
        
        return schedule_data
    
    def _calculate_carry_over_flags(self, solver, shifts, nurses, days):
        return {nurse['id']: False for nurse in nurses}