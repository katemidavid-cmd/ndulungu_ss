import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const users = [
  {
    email: "mkuu@shule.ac.tz",
    password: "Mkuu123!",
    profile: {
      first_name: "Juma",
      middle_name: "Hassan",
      last_name: "Mwaipopo",
      sex: "M",
      phone: "0754000001",
      role: "headmaster",
    },
  },
  {
    email: "masomo@shule.ac.tz",
    password: "Masomo123!",
    profile: {
      first_name: "Asha",
      middle_name: "Omari",
      last_name: "Kimaro",
      sex: "F",
      phone: "0754000002",
      role: "academic",
    },
  },
  {
    email: "mwalimu1@shule.ac.tz",
    password: "Mwalimu123!",
    profile: {
      first_name: "Peter",
      middle_name: "John",
      last_name: "Mshana",
      sex: "M",
      phone: "0754000003",
      role: "teacher",
    },
  },
  {
    email: "mwalimu2@shule.ac.tz",
    password: "Mwalimu123!",
    profile: {
      first_name: "Rehema",
      middle_name: "Salum",
      last_name: "Nyerere",
      sex: "F",
      phone: "0754000004",
      role: "teacher",
    },
  },
];

const assignments = [
  { teacherEmail: "mwalimu1@shule.ac.tz", class_name: "Form 1", subject_name: "Kiswahili" },
  { teacherEmail: "mwalimu1@shule.ac.tz", class_name: "Form 2", subject_name: "Kiswahili" },
  { teacherEmail: "mwalimu2@shule.ac.tz", class_name: "Form 1", subject_name: "Historia" },
  { teacherEmail: "mwalimu2@shule.ac.tz", class_name: "Form 3", subject_name: "Historia" },
];

async function seed() {
  for (const u of users) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    if (error) {
      console.log(`Kosa kuunda ${u.email}:`, error.message);
      continue;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      first_name: u.profile.first_name,
      middle_name: u.profile.middle_name,
      last_name: u.profile.last_name,
      sex: u.profile.sex,
      phone: u.profile.phone,
      email: u.email,
      role: u.profile.role,
    });

    if (profileError) {
      console.log(`Kosa kuweka profile ${u.email}:`, profileError.message);
    } else {
      console.log(`Imekamilika: ${u.email} (${u.profile.role})`);
    }
  }

  // Assignments
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email");

  const map = new Map(profiles?.map((p) => [p.email, p.id]));

  for (const a of assignments) {
    const teacher_id = map.get(a.teacherEmail);
    if (!teacher_id) continue;
    const { error } = await supabase.from("teaching_assignments").insert({
      teacher_id,
      class_name: a.class_name,
      subject_name: a.subject_name,
    });
    if (error) console.log("Kosa assignment:", error.message);
    else console.log(`Mgawo umewekwa: ${a.teacherEmail} -> ${a.class_name} ${a.subject_name}`);
  }

  console.log("Seed imekamilika.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
