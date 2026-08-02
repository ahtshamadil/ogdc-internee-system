import { all, get, run, tx } from './index.js';
import { seed } from './seed.js';
import { nextInternCode } from '../utils/internCode.js';
import { weeksBetween } from '../utils/validate.js';

/**
 * Realistic demo data.
 *
 * Without a few hundred rows spread across several years neither the analytics
 * nor the visual design can actually be judged -- an empty dashboard looks fine
 * and proves nothing.
 */

const FIRST_M = ['Ahmed', 'Muhammad', 'Ali', 'Hassan', 'Usman', 'Bilal', 'Hamza', 'Faisal', 'Zain', 'Omar',
  'Saad', 'Talha', 'Danish', 'Kashif', 'Adnan', 'Waqas', 'Imran', 'Junaid', 'Shahzaib', 'Fahad',
  'Abdullah', 'Ibrahim', 'Yasir', 'Noman', 'Salman', 'Arslan', 'Rehan', 'Umair', 'Asad', 'Haris'];
const FIRST_F = ['Ayesha', 'Fatima', 'Zainab', 'Maryam', 'Hira', 'Sana', 'Amna', 'Iqra', 'Sadia', 'Nimra',
  'Rabia', 'Mahnoor', 'Areeba', 'Laiba', 'Khadija', 'Aiman', 'Anum', 'Bushra', 'Sidra', 'Komal',
  'Warda', 'Eman', 'Tuba', 'Javeria', 'Noor'];
const LAST = ['Khan', 'Ahmed', 'Ali', 'Hussain', 'Malik', 'Butt', 'Sheikh', 'Chaudhry', 'Raza', 'Iqbal',
  'Mehmood', 'Aslam', 'Nawaz', 'Farooq', 'Siddiqui', 'Qureshi', 'Abbasi', 'Baig', 'Shah', 'Awan',
  'Rehman', 'Yousaf', 'Zafar', 'Nadeem', 'Tariq', 'Bhatti', 'Gill', 'Sultan', 'Rana', 'Dar'];

// Deterministic PRNG so re-seeding produces a comparable dataset.
let seedValue = 20260728;
const rand = () => {
  seedValue = (seedValue * 1103515245 + 12345) & 0x7fffffff;
  return seedValue / 0x7fffffff;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pickWeighted = (arr, weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < arr.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
};
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
const iso = (d) => d.toISOString().slice(0, 10);

const addDays = (date, n) => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + n);
  return next;
};

export function seedDemo({ count = 240, verbose = true } = {}) {
  // verbose passes through so a first run still prints the admin password --
  // it is shown exactly once and there is no way to recover it afterwards.
  const { admin: newAdmin } = seed({ verbose });

  const existing = get('SELECT COUNT(*) AS n FROM interns WHERE deleted_at IS NULL').n;
  if (existing > 0) {
    if (verbose) console.log(`[seed:demo] ${existing} interns already present -- nothing generated.`);
    if (verbose) console.log('[seed:demo] To regenerate, delete the database file and run this again.');
    return { created: 0, skipped: true };
  }

  const universities = all('SELECT id, name, city FROM universities');
  const degrees = all('SELECT id, name, level FROM degrees');
  const departments = all('SELECT id, name FROM departments');
  const cities = all('SELECT id, name FROM cities');
  const supervisors = all('SELECT id, department_id FROM supervisors');
  const admin = get("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");

  // A handful of sources supply most interns, which is what a real intake looks
  // like -- a uniform spread would make the "top universities" chart flat and
  // useless as a design check.
  //
  // Weighted by NAME rather than row position: these queries come back sorted
  // alphabetically, so positional weights would crown whichever name happens to
  // sort first and produce nonsense like Abbottabad as the top source city.
  const weightBy = (rows, heavy, medium) =>
    rows.map((row) => {
      const name = row.name ?? '';
      if (heavy.some((n) => name.includes(n))) return 10;
      if (medium.some((n) => name.includes(n))) return 4;
      return 1;
    });

  // OGDC's head office is in Islamabad, so the twin cities dominate intake.
  const uniWeights = weightBy(
    universities,
    ['National University of Sciences', 'COMSATS', 'Quaid-i-Azam', 'International Islamic', 'Air University', 'Bahria'],
    ['NUML', 'Capital University', 'Fatima Jinnah', 'Arid Agriculture', 'Taxila', 'PIEAS', 'Institute of Space'],
  );
  const cityWeights = weightBy(
    cities,
    ['Islamabad', 'Rawalpindi'],
    ['Lahore', 'Peshawar', 'Karachi', 'Abbottabad', 'Faisalabad', 'Multan'],
  );
  const deptWeights = weightBy(
    departments,
    ['Exploration', 'Drilling', 'Production', 'Finance and Accounts', 'Information Systems'],
    ['Reservoir', 'Geological', 'Geophysical', 'Petroleum Engineering', 'Human Resource', 'Process Engineering'],
  );

  const today = new Date();
  const earliest = addDays(today, -3 * 365 - 60);

  const created = tx(() => {
    const rows = [];

    for (let i = 0; i < count; i += 1) {
      const gender = rand() < 0.34 ? 'Female' : 'Male';
      const firstName = gender === 'Female' ? pick(FIRST_F) : pick(FIRST_M);
      const fullName = `${firstName} ${pick(LAST)}`;

      const university = pickWeighted(universities, uniWeights);
      const degree = pick(degrees);
      const department = pickWeighted(departments, deptWeights);
      const city = pickWeighted(cities, cityWeights);
      const deptSupervisors = supervisors.filter((s) => s.department_id === department.id);
      const supervisor = deptSupervisors.length ? pick(deptSupervisors) : pick(supervisors);

      // Intake clusters in summer (Jun-Aug) and winter (Dec-Jan) breaks, so the
      // trend chart has a shape rather than noise.
      const daySpan = Math.floor((today - earliest) / 86400000);
      let joining = addDays(earliest, between(0, daySpan));
      const month = joining.getUTCMonth();
      if (![5, 6, 7, 0, 11].includes(month) && rand() < 0.62) {
        joining = new Date(Date.UTC(joining.getUTCFullYear(), pick([5, 6, 7, 0, 11]), between(1, 28)));
        if (joining > today) joining.setUTCFullYear(joining.getUTCFullYear() - 1);
      }
      if (joining < earliest) joining = addDays(earliest, between(0, 30));

      const durationWeeks = pick([6, 6, 8, 8, 8, 12, 12, 16, 24]);
      const end = addDays(joining, durationWeeks * 7);

      let status;
      if (joining > today) status = 'Upcoming';
      else if (end > today) status = rand() < 0.08 ? 'Extended' : 'Active';
      else if (rand() < 0.05) status = 'Terminated';
      else status = 'Completed';

      const isFinished = status === 'Completed';
      const certificateIssued = isFinished && rand() < 0.72 ? 1 : 0;

      rows.push({
        full_name: fullName,
        father_name: `${pick(FIRST_M)} ${pick(LAST)}`,
        cnic: `${between(11, 82)}${between(100, 499)}-${between(1000000, 9999999)}-${between(1, 9)}`,
        gender,
        dob: iso(new Date(Date.UTC(between(1998, 2005), between(0, 11), between(1, 28)))),
        phone: `03${between(0, 4)}${between(10000000, 99999999)}`,
        email: `${firstName.toLowerCase()}.${between(100, 999)}@example.com`,
        address: `House ${between(1, 400)}, Street ${between(1, 60)}, ${city.name}`,
        city_id: city.id,
        emergency_contact_name: `${pick(FIRST_M)} ${pick(LAST)}`,
        emergency_contact_phone: `03${between(0, 4)}${between(10000000, 99999999)}`,
        referred_by: rand() < 0.25 ? `${pick(FIRST_M)} ${pick(LAST)}` : null,
        university_id: university.id,
        degree_id: degree.id,
        // Only strip a prefix that is a separate word, or "MBA" becomes "BA"
        // and "M.Com" becomes ".Com".
        major: degree.name.replace(/^(BS|MS|BE|ME|PhD|DAE)\s+/i, '').trim(),
        semester: `${between(5, 8)}th`,
        cgpa: Number((2.4 + rand() * 1.6).toFixed(2)),
        enrollment_no: `${between(2019, 2024)}-${String(between(1, 999)).padStart(3, '0')}`,
        department_id: department.id,
        supervisor_id: supervisor?.id ?? null,
        joining_date: iso(joining),
        end_date: iso(end),
        duration_weeks: weeksBetween(iso(joining), iso(end)),
        status,
        certificate_issued: certificateIssued,
        certificate_date: certificateIssued ? iso(addDays(end, between(3, 30))) : null,
        certificate_no: certificateIssued ? `OGDC/CERT/${between(1000, 9999)}` : null,
        evaluation_rating: isFinished ? between(3, 5) : null,
        evaluation_remarks: isFinished
          ? pick([
              'Performed well and showed strong initiative throughout the internship.',
              'Good technical grasp, punctual and cooperative with the team.',
              'Satisfactory performance; would benefit from more exposure to field operations.',
              'Excellent analytical skills and a quick learner.',
              'Reliable and diligent, contributed meaningfully to departmental tasks.',
            ])
          : null,
        notes: null,
      });
    }

    // Insert oldest first so intern_code sequence numbers follow joining order.
    rows.sort((a, b) => a.joining_date.localeCompare(b.joining_date));

    const columns = Object.keys(rows[0]);
    let n = 0;
    for (const row of rows) {
      const code = nextInternCode(row.joining_date);
      run(
        `INSERT INTO interns (intern_code, ${columns.join(', ')}, created_by, created_at)
         VALUES (?, ${columns.map(() => '?').join(', ')}, ?, datetime('now'))`,
        [code, ...columns.map((c) => row[c] ?? null), admin?.id ?? null],
      );
      n += 1;
    }
    return n;
  });

  if (verbose) {
    const summary = get(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed,
              MIN(joining_date) AS first_joining, MAX(joining_date) AS last_joining
         FROM interns WHERE deleted_at IS NULL`,
    );
    console.log(`[seed:demo] created ${created} interns`);
    console.log(`[seed:demo] ${summary.active} active, ${summary.completed} completed`);
    console.log(`[seed:demo] joining dates ${summary.first_joining} .. ${summary.last_joining}`);
  }

  return { created, skipped: false, admin: newAdmin };
}

if (process.argv[1]?.endsWith('seedDemo.js')) seedDemo();
