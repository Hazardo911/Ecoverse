import { Router } from "express";

// Curated from each organisation's official contact or volunteer page.
// Keep this directory link-first so stale phone numbers are not copied into the app.
const organizations = [
  { id: "greenpeace-india", name: "Greenpeace India", region: "India", cities: ["Bengaluru", "Chennai"], focus: ["Climate", "Biodiversity", "Environmental justice"], description: "Campaigns with communities and trains volunteers for environmental action.", website: "https://www.greenpeace.org/india/en/", volunteer: "https://www.greenpeace.org/india/en/volunteers-corner/", contact: "https://www.greenpeace.org/india/en/contact-us/", image: "https://www.greenpeace.org/static/planet4-india-stateless/2023/07/4c4b0f8a-gp0stx1.jpg" },
  { id: "efi", name: "Environmentalist Foundation of India", region: "India", cities: ["Chennai", "Mumbai", "Delhi", "Bengaluru", "Pune", "Hyderabad", "Kolkata"], focus: ["Habitat restoration", "Wildlife", "Water bodies"], description: "Volunteer-led conservation and habitat restoration programmes across Indian cities.", website: "https://indiaenvironment.org/", volunteer: "https://indiaenvironment.org/volunteer/", contact: "https://indiaenvironment.org/contact/", image: "https://indiaenvironment.org/wp-content/uploads/2020/06/efi-logo.png" },
  { id: "earthwatch", name: "Earthwatch Institute", region: "Global", cities: ["Oxford", "Gurugram", "Boston", "Melbourne", "Tokyo"], focus: ["Field science", "Education", "Conservation"], description: "Connects people with environmental field research and conservation expeditions.", website: "https://earthwatch.org/", volunteer: "https://earthwatch.org/expeditions", contact: "https://earthwatch.org/contact", image: "https://earthwatch.org/themes/custom/earthwatch/logo.svg" },
  { id: "350", name: "350.org", region: "Global", cities: ["Online", "Local chapters worldwide"], focus: ["Climate", "Clean energy", "Climate justice"], description: "A global climate movement with local groups, training and campaigns.", website: "https://350.org/", volunteer: "https://350.org/get-involved/", contact: "https://350.org/contact/", image: "https://350.org/wp-content/uploads/2020/07/350-logo.png" },
  { id: "samarpan", name: "Samarpan Foundation", region: "India", cities: ["Mumbai", "Bengaluru", "New Delhi", "Pune", "Goa"], focus: ["Community action", "Environment", "Volunteering"], description: "A volunteer network with city coordinators and environmental initiatives.", website: "https://samarpanfoundation.org/", volunteer: "https://samarpanfoundation.org/contact-us", contact: "https://samarpanfoundation.org/contact-us", image: "https://samarpanfoundation.org/wp-content/uploads/2022/11/logo.png" },
  { id: "wwf-india", name: "WWF-India", region: "India", cities: ["New Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Goa", "Kolkata"], focus: ["Wildlife", "Rivers", "Climate", "Education"], description: "Conservation programmes and volunteer routes across Indian landscapes and cities.", website: "https://www.wwfindia.org/", volunteer: "https://people4planet.wwfindia.org/why-volunteer.php", contact: "https://www.wwfindia.org/engage_with_us/connect/contact_us/", image: "https://www.wwfindia.org/themes/custom/wwf/logo.svg" },
  { id: "iucn", name: "IUCN", region: "Global", cities: ["Gland", "Regional offices worldwide"], focus: ["Conservation science", "Policy", "Biodiversity"], description: "A global conservation union connecting science, policy and member organisations.", website: "https://iucn.org/", volunteer: "https://iucn.org/get-involved", contact: "https://iucn.org/contact", image: "https://iucn.org/themes/custom/iucn/logo.svg" },
  { id: "birdlife", name: "BirdLife International", region: "Global", cities: ["Cambridge", "National partners worldwide"], focus: ["Birds", "Biodiversity", "Habitats"], description: "A global partnership of national conservation organisations focused on birds and biodiversity.", website: "https://www.birdlife.org/", volunteer: "https://www.birdlife.org/how-we-work/", contact: "https://www.birdlife.org/contact-us/", image: "https://www.birdlife.org/wp-content/themes/birdlife/assets/images/logo.svg" },
  { id: "conservation-international", name: "Conservation International", region: "Global", cities: ["Arlington", "Field programmes worldwide"], focus: ["Climate", "Oceans", "Forests", "Communities"], description: "Works with communities and partners to protect nature and support human well-being.", website: "https://www.conservation.org/", volunteer: "https://www.conservation.org/get-involved", contact: "https://www.conservation.org/contact", image: "https://www.conservation.org/images/default-source/logos/ci-logo.svg" },
  { id: "participate-mumbai", name: "Participate Mumbai", region: "Mumbai", cities: ["Mumbai"], focus: ["Beach cleanups", "Tree planting", "Waste", "Gardens"], description: "Official civic volunteering routes for environmental and community projects across Mumbai.", website: "https://participatemumbai.mcgm.gov.in/volunteer", volunteer: "https://participatemumbai.mcgm.gov.in/volunteer", contact: "https://participatemumbai.mcgm.gov.in/", image: "" },
  { id: "hara-jeevan", name: "Hara Jeevan", region: "India", cities: ["Delhi NCR", "India"], focus: ["Water restoration", "Afforestation", "Waste", "Education"], description: "Community-driven environmental restoration and green education initiatives.", website: "https://harajeevan.org/", volunteer: "https://harajeevan.org/", contact: "https://harajeevan.org/", image: "" },
];
const missionImages = [
  "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1437482078695-73f5ca6c96e2?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1452570053594-1b985d6ea890?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1523742811481-1c33e5b8e8e2?auto=format&fit=crop&w=900&q=80",
];
organizations.forEach((organization, index) => {
  organization.image = missionImages[index % missionImages.length];
  organization.imageCredit = "Illustrative photo via Unsplash";
});

export function organizationRoutes() {
  const router = Router();
  router.get("/organizations", (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const city = String(req.query.city || "").trim().toLowerCase();
    const data = organizations.filter((org) => {
      const text = [org.name, org.region, ...org.cities, ...org.focus].join(" ").toLowerCase();
      return (!q || text.includes(q)) && (!city || org.cities.some((value) => value.toLowerCase().includes(city)));
    });
    res.json({ data, meta: { sourcePolicy: "Official organisation links; verify availability and eligibility on the linked site." } });
  });
  return router;
}
