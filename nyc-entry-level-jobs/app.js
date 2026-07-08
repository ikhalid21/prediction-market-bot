// --- Job board search link generator ---

function buildSearchLinks(keyword, borough, category) {
  const term = [keyword, category].filter(Boolean).join(" ").trim() || "entry level";
  const q = encodeURIComponent(term + " entry level");
  const loc = encodeURIComponent(`${borough}, NY`);
  const locPlain = encodeURIComponent(borough);

  return [
    {
      name: "Indeed",
      url: `https://www.indeed.com/jobs?q=${q}&l=${loc}&explvl=entry_level`,
    },
    {
      name: "LinkedIn",
      url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(term)}&location=${encodeURIComponent(borough + ", New York, United States")}&f_E=1,2`,
    },
    {
      name: "Glassdoor",
      url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(term)}&locKeyword=${loc}`,
    },
    {
      name: "ZipRecruiter",
      url: `https://www.ziprecruiter.com/candidate/search?search=${q}&location=${loc}`,
    },
    {
      name: "Google Jobs",
      url: `https://www.google.com/search?q=${q}+jobs+in+${locPlain}+NY&ibp=htl;jobs`,
    },
    {
      name: "NYC.gov Jobs (city gov't)",
      url: `https://www.nyc.gov/jobs`,
    },
    {
      name: "NYC Workforce1 Career Centers",
      url: `https://www.nyc.gov/site/sbs/careers/workforce1.page`,
    },
    {
      name: "USAJobs (federal)",
      url: `https://www.usajobs.gov/Search/Results?k=${encodeURIComponent(term)}&l=New%20York%2C%20New%20York`,
    },
  ];
}

function renderSearchLinks(links) {
  const grid = document.getElementById("link-grid");
  grid.innerHTML = "";
  links.forEach((link) => {
    const a = document.createElement("a");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = link.name;
    grid.appendChild(a);
  });
  document.getElementById("results").classList.remove("hidden");
}

document.getElementById("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const keyword = document.getElementById("keyword").value.trim();
  const borough = document.getElementById("borough").value;
  const categorySelect = document.getElementById("category");
  const category = categorySelect.value;
  const links = buildSearchLinks(keyword, borough, category);
  renderSearchLinks(links);
  document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "nearest" });
});

// --- NYC workforce resources ---

const RESOURCES = [
  {
    name: "NYC Workforce1 Career Centers",
    desc: "Free city-run career centers with job placement, resume help, and training referrals in every borough.",
    url: "https://www.nyc.gov/site/sbs/careers/workforce1.page",
  },
  {
    name: "Per Scholas",
    desc: "Free tech training (IT support, cybersecurity, software) for adults with no experience required, plus job placement.",
    url: "https://perscholas.org/",
  },
  {
    name: "Year Up",
    desc: "Paid training + internship program for young adults (18-29) leading to entry-level corporate roles.",
    url: "https://www.yearup.org/",
  },
  {
    name: "JobsFirstNYC",
    desc: "Connects young adults (16-24) to paid internships, apprenticeships, and career-track entry jobs.",
    url: "https://jobsfirstnyc.org/",
  },
  {
    name: "CUNY Career Launch / Career Services",
    desc: "Free career coaching and job boards open to CUNY students and many NYC residents.",
    url: "https://www.cuny.edu/academics/current-initiatives/career-success/",
  },
  {
    name: "NYC Public Engagement Unit Job Fairs",
    desc: "Free city-run hiring events and job fairs posted throughout the year across NYC.",
    url: "https://www.nyc.gov/content/publicengagementunit/pages/upcoming-events",
  },
  {
    name: "Emma's Torch",
    desc: "Culinary/hospitality training program with direct job placement for entry-level roles.",
    url: "https://www.emmastorch.org/",
  },
  {
    name: "NYC Justice Corps / Ladders for Leaders",
    desc: "Paid summer internship and workforce programs for NYC youth and young adults.",
    url: "https://www.nyc.gov/site/dycd/services/employment.page",
  },
];

function renderResources() {
  const grid = document.getElementById("resource-grid");
  grid.innerHTML = "";
  RESOURCES.forEach((r) => {
    const card = document.createElement("div");
    card.className = "resource-card";
    card.innerHTML = `
      <h3>${r.name}</h3>
      <p>${r.desc}</p>
      <a href="${r.url}" target="_blank" rel="noopener noreferrer">Visit site &rarr;</a>
    `;
    grid.appendChild(card);
  });
}

// --- Checklist with localStorage ---

const CHECKLIST_ITEMS = [
  "Write a one-page resume tailored to entry-level roles (no experience needed listed as coursework/volunteer/skills)",
  "Create or update a LinkedIn profile with a clear headline and photo",
  "Set job alerts on Indeed and LinkedIn for your target roles in NYC",
  "Apply within 2-3 days of a posting going live",
  "Customize your resume/cover letter with keywords from each job post",
  "Reach out to 1-2 people in your network for an informational chat each week",
  "Visit a Workforce1 Career Center or attend an NYC job fair",
  "Follow up on applications after 5-7 business days if you haven't heard back",
  "Prepare answers for common interview questions (tell me about yourself, why this role)",
  "Track every application in the tracker below",
];

const CHECKLIST_KEY = "nyc-jobs-checklist";

function loadChecklistState() {
  try {
    return JSON.parse(localStorage.getItem(CHECKLIST_KEY)) || {};
  } catch {
    return {};
  }
}

function saveChecklistState(state) {
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
}

function renderChecklist() {
  const list = document.getElementById("checklist");
  const state = loadChecklistState();
  list.innerHTML = "";
  CHECKLIST_ITEMS.forEach((item, i) => {
    const li = document.createElement("li");
    const checked = !!state[i];
    li.innerHTML = `
      <input type="checkbox" id="chk-${i}" ${checked ? "checked" : ""} />
      <label for="chk-${i}" class="${checked ? "checked" : ""}">${item}</label>
    `;
    list.appendChild(li);
    li.querySelector("input").addEventListener("change", (e) => {
      const s = loadChecklistState();
      s[i] = e.target.checked;
      saveChecklistState(s);
      li.querySelector("label").classList.toggle("checked", e.target.checked);
    });
  });
}

// --- Application tracker with localStorage ---

const TRACKER_KEY = "nyc-jobs-tracker";

function loadTracker() {
  try {
    return JSON.parse(localStorage.getItem(TRACKER_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTracker(entries) {
  localStorage.setItem(TRACKER_KEY, JSON.stringify(entries));
}

function renderTracker() {
  const entries = loadTracker();
  const body = document.getElementById("tracker-body");
  const empty = document.getElementById("tracker-empty");
  body.innerHTML = "";

  if (entries.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  entries.forEach((entry, i) => {
    const tr = document.createElement("tr");
    const companyCell = entry.link
      ? `<a href="${entry.link}" target="_blank" rel="noopener noreferrer">${entry.company}</a>`
      : entry.company;
    tr.innerHTML = `
      <td>${companyCell}</td>
      <td class="role-cell">${entry.role}</td>
      <td>
        <select class="status-select" data-index="${i}">
          ${["Saved", "Applied", "Interview", "Offer", "Rejected"]
            .map((s) => `<option ${s === entry.status ? "selected" : ""}>${s}</option>`)
            .join("")}
        </select>
      </td>
      <td>${entry.date}</td>
      <td><button class="remove-btn" data-index="${i}" type="button">&times;</button></td>
    `;
    body.appendChild(tr);
  });

  body.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const entries = loadTracker();
      entries[+e.target.dataset.index].status = e.target.value;
      saveTracker(entries);
    });
  });

  body.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const entries = loadTracker();
      entries.splice(+e.target.dataset.index, 1);
      saveTracker(entries);
      renderTracker();
    });
  });
}

document.getElementById("tracker-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const company = document.getElementById("t-company").value.trim();
  const role = document.getElementById("t-role").value.trim();
  const link = document.getElementById("t-link").value.trim();
  const status = document.getElementById("t-status").value;
  if (!company || !role) return;

  const entries = loadTracker();
  entries.push({
    company,
    role,
    link,
    status,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  });
  saveTracker(entries);
  renderTracker();
  e.target.reset();
});

// --- Init ---

renderResources();
renderChecklist();
renderTracker();
