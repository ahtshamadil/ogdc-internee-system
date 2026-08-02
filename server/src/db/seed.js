import { run, get, tx } from './index.js';
import { migrate } from './migrate.js';
import { hashPassword, generatePassword } from '../utils/password.js';

const CITIES = [
  ['Islamabad', 'Federal'], ['Rawalpindi', 'Punjab'], ['Lahore', 'Punjab'],
  ['Faisalabad', 'Punjab'], ['Multan', 'Punjab'], ['Gujranwala', 'Punjab'],
  ['Sialkot', 'Punjab'], ['Sargodha', 'Punjab'], ['Bahawalpur', 'Punjab'],
  ['Karachi', 'Sindh'], ['Hyderabad', 'Sindh'], ['Sukkur', 'Sindh'],
  ['Larkana', 'Sindh'], ['Peshawar', 'Khyber Pakhtunkhwa'],
  ['Mardan', 'Khyber Pakhtunkhwa'], ['Abbottabad', 'Khyber Pakhtunkhwa'],
  ['Swat', 'Khyber Pakhtunkhwa'], ['Kohat', 'Khyber Pakhtunkhwa'],
  ['Dera Ismail Khan', 'Khyber Pakhtunkhwa'], ['Quetta', 'Balochistan'],
  ['Gwadar', 'Balochistan'], ['Sibi', 'Balochistan'], ['Muzaffarabad', 'AJK'],
  ['Mirpur', 'AJK'], ['Gilgit', 'Gilgit-Baltistan'],
];

const UNIVERSITIES = [
  ['National University of Sciences and Technology', 'NUST', 'Islamabad'],
  ['Quaid-i-Azam University', 'QAU', 'Islamabad'],
  ['COMSATS University Islamabad', 'CUI', 'Islamabad'],
  ['International Islamic University Islamabad', 'IIUI', 'Islamabad'],
  ['Air University', 'AU', 'Islamabad'],
  ['Bahria University', 'BU', 'Islamabad'],
  ['Capital University of Science and Technology', 'CUST', 'Islamabad'],
  ['Federal Urdu University of Arts, Science and Technology', 'FUUAST', 'Islamabad'],
  ['National University of Modern Languages', 'NUML', 'Islamabad'],
  ['Pakistan Institute of Engineering and Applied Sciences', 'PIEAS', 'Islamabad'],
  ['Institute of Space Technology', 'IST', 'Islamabad'],
  ['University of Engineering and Technology Taxila', 'UET Taxila', 'Rawalpindi'],
  ['Fatima Jinnah Women University', 'FJWU', 'Rawalpindi'],
  ['Arid Agriculture University Rawalpindi', 'PMAS-AAUR', 'Rawalpindi'],
  ['University of the Punjab', 'PU', 'Lahore'],
  ['University of Engineering and Technology Lahore', 'UET Lahore', 'Lahore'],
  ['Lahore University of Management Sciences', 'LUMS', 'Lahore'],
  ['University of Management and Technology', 'UMT', 'Lahore'],
  ['Government College University Lahore', 'GCU', 'Lahore'],
  ['FAST National University', 'FAST-NU', 'Lahore'],
  ['Information Technology University', 'ITU', 'Lahore'],
  ['University of Central Punjab', 'UCP', 'Lahore'],
  ['NED University of Engineering and Technology', 'NED', 'Karachi'],
  ['University of Karachi', 'KU', 'Karachi'],
  ['Institute of Business Administration Karachi', 'IBA', 'Karachi'],
  ['Mehran University of Engineering and Technology', 'MUET', 'Hyderabad'],
  ['University of Sindh', 'USindh', 'Hyderabad'],
  ['University of Peshawar', 'UoP', 'Peshawar'],
  ['University of Engineering and Technology Peshawar', 'UET Peshawar', 'Peshawar'],
  ['Institute of Management Sciences Peshawar', 'IMSciences', 'Peshawar'],
  ['CECOS University', 'CECOS', 'Peshawar'],
  ['University of Balochistan', 'UoB', 'Quetta'],
  ['Balochistan University of Information Technology, Engineering and Management Sciences', 'BUITEMS', 'Quetta'],
  ['Bahauddin Zakariya University', 'BZU', 'Multan'],
  ['Islamia University Bahawalpur', 'IUB', 'Bahawalpur'],
  ['University of Agriculture Faisalabad', 'UAF', 'Faisalabad'],
  ['Abbottabad University of Science and Technology', 'AUST', 'Abbottabad'],
  ['University of Azad Jammu and Kashmir', 'UAJK', 'Muzaffarabad'],
];

const DEGREES = [
  ['BS Petroleum Engineering', 'Bachelors'], ['BS Geology', 'Bachelors'],
  ['BS Geophysics', 'Bachelors'], ['BS Mechanical Engineering', 'Bachelors'],
  ['BS Electrical Engineering', 'Bachelors'], ['BS Chemical Engineering', 'Bachelors'],
  ['BS Civil Engineering', 'Bachelors'], ['BS Computer Science', 'Bachelors'],
  ['BS Software Engineering', 'Bachelors'], ['BS Information Technology', 'Bachelors'],
  ['BS Environmental Science', 'Bachelors'], ['BS Chemistry', 'Bachelors'],
  ['BBA', 'Bachelors'], ['BS Accounting and Finance', 'Bachelors'],
  ['BS Economics', 'Bachelors'], ['LLB', 'Bachelors'],
  ['MS Petroleum Engineering', 'Masters'], ['MS Geology', 'Masters'],
  ['MS Computer Science', 'Masters'], ['MBA', 'Masters'],
  ['MS Project Management', 'Masters'], ['M.Com', 'Masters'],
  ['ACCA', 'Professional'], ['CA (Chartered Accountancy)', 'Professional'],
  ['DAE Mechanical', 'Diploma'], ['DAE Electrical', 'Diploma'],
  ['PhD Geosciences', 'Doctorate'],
];

// OGDC's operating structure -- interns are placed against these.
const DEPARTMENTS = [
  ['Exploration', 'EXP'], ['Drilling', 'DRL'], ['Production', 'PRD'],
  ['Reservoir Management', 'RES'], ['Geological Services', 'GEO'],
  ['Geophysical Services', 'GPH'], ['Petroleum Engineering', 'PET'],
  ['Process Engineering', 'PRC'], ['Mechanical Engineering', 'MEC'],
  ['Electrical Engineering', 'ELC'], ['Civil Engineering', 'CIV'],
  ['Instrumentation and Control', 'INC'], ['Finance and Accounts', 'FIN'],
  ['Corporate Finance', 'CFN'], ['Internal Audit', 'AUD'],
  ['Human Resource', 'HR'], ['Administration', 'ADM'],
  ['Information Systems', 'IS'], ['Supply Chain Management', 'SCM'],
  ['Procurement and Contracts', 'PRO'], ['Health, Safety and Environment', 'HSE'],
  ['Legal Affairs', 'LGL'], ['Corporate Communication', 'CC'],
  ['Planning and Development', 'PND'], ['Quality Assurance', 'QA'],
  ['Research and Development', 'RND'], ['Security', 'SEC'],
  ['Medical Services', 'MED'], ['Training and Development', 'TND'],
  ['Joint Ventures', 'JV'],
];

const SUPERVISORS = [
  ['Muhammad Asif Raza', 'General Manager', 'Exploration'],
  ['Sadia Kamran', 'Deputy General Manager', 'Finance and Accounts'],
  ['Imran Haider Shah', 'Chief Engineer', 'Drilling'],
  ['Nadia Rehman', 'Senior Manager', 'Human Resource'],
  ['Tariq Mehmood Butt', 'Manager', 'Production'],
  ['Ayesha Siddiqui', 'Manager', 'Information Systems'],
  ['Zafar Iqbal Khan', 'Chief Geologist', 'Geological Services'],
  ['Hina Aslam', 'Deputy Manager', 'Internal Audit'],
  ['Kashif Nadeem', 'Senior Engineer', 'Reservoir Management'],
  ['Farah Naz Malik', 'Manager', 'Health, Safety and Environment'],
  ['Bilal Ahmed Chaudhry', 'Deputy Manager', 'Supply Chain Management'],
  ['Rabia Tanveer', 'Manager', 'Training and Development'],
  ['Shahid Mahmood', 'Chief Engineer', 'Process Engineering'],
  ['Uzma Batool', 'Senior Manager', 'Corporate Finance'],
  ['Adnan Yousaf', 'Manager', 'Petroleum Engineering'],
];

function insertMany(sql, rows) {
  let inserted = 0;
  for (const row of rows) {
    const res = run(sql, row);
    inserted += res.changes;
  }
  return inserted;
}

export function seedLookups() {
  return tx(() => {
    const counts = {};
    counts.cities = insertMany('INSERT OR IGNORE INTO cities (name, province) VALUES (?, ?)', CITIES);
    counts.universities = insertMany(
      'INSERT OR IGNORE INTO universities (name, short_name, city) VALUES (?, ?, ?)',
      UNIVERSITIES,
    );
    counts.degrees = insertMany('INSERT OR IGNORE INTO degrees (name, level) VALUES (?, ?)', DEGREES);
    counts.departments = insertMany(
      'INSERT OR IGNORE INTO departments (name, code) VALUES (?, ?)',
      DEPARTMENTS,
    );

    counts.supervisors = 0;
    for (const [name, designation, deptName] of SUPERVISORS) {
      const exists = get('SELECT id FROM supervisors WHERE name = ?', [name]);
      if (exists) continue;
      const dept = get('SELECT id FROM departments WHERE name = ?', [deptName]);
      run('INSERT INTO supervisors (name, designation, department_id) VALUES (?, ?, ?)', [
        name,
        designation,
        dept?.id ?? null,
      ]);
      counts.supervisors += 1;
    }
    return counts;
  });
}

/**
 * Creates the first admin if there are no users at all. The password is random
 * and printed exactly once -- there is no default password to forget to change.
 */
export function seedAdmin() {
  const existing = get('SELECT COUNT(*) AS n FROM users').n;
  if (existing > 0) return null;

  const password = generatePassword(14);
  run(
    `INSERT INTO users (username, password_hash, full_name, role, must_change_password)
     VALUES (?, ?, ?, 'admin', 1)`,
    ['admin', hashPassword(password), 'System Administrator'],
  );
  return { username: 'admin', password };
}

export function seed({ verbose = true } = {}) {
  migrate({ verbose });
  const counts = seedLookups();
  const admin = seedAdmin();

  if (verbose) {
    console.log('[seed] lookups:', counts);
    if (admin) {
      console.log(
        '\n' +
          '  ┌──────────────────────────────────────────────────────┐\n' +
          '  │  Administrator account created                       │\n' +
          `  │  username: ${admin.username.padEnd(42)}│\n` +
          `  │  password: ${admin.password.padEnd(42)}│\n` +
          '  │                                                      │\n' +
          '  │  This is shown once. You must change it at login.    │\n' +
          '  └──────────────────────────────────────────────────────┘\n',
      );
    } else {
      console.log('[seed] users already exist, admin not recreated');
    }
  }
  return { counts, admin };
}

if (process.argv[1]?.endsWith('seed.js')) seed();
