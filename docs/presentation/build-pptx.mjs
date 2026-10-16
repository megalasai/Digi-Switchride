import PptxGenJS from "pptxgenjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(__dirname, "screenshots");
const out = path.join(__dirname, "Fleetel-Digi-Switchride-Customer-Presentation.pptx");

const NAVY = "16192A";
const BLUE = "5B7CFA";
const WHITE = "FFFFFF";
const MUTED = "667085";
const LIGHT = "F4F6FB";
const INK = "1D2433";

const pres = new PptxGenJS();
pres.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pres.layout = "WIDE";
pres.author = "Fleetel";
pres.title = "Digi-Switchride — Customer Presentation";
pres.subject = "EV rental operations platform — web operations portal and rider mobile app";
pres.company = "Fleetel";

function addBg(slide, color = NAVY) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color } });
}

function footer(slide, page) {
  slide.addText("Confidential  ·  Presented by Fleetel  ·  Digi-Switchride", {
    x: 0.5, y: 7.15, w: 10, h: 0.25, fontSize: 10, color: MUTED, fontFace: "Calibri",
  });
  slide.addText(String(page), {
    x: 12.2, y: 7.15, w: 0.7, h: 0.25, fontSize: 10, color: MUTED, align: "right", fontFace: "Calibri",
  });
}

function img(name) {
  const p = path.join(shots, name);
  return fs.existsSync(p) ? p : null;
}

function shotSlide(page, title, subtitle, file, bullets) {
  const slide = pres.addSlide();
  addBg(slide, LIGHT);
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 0.7, fill: { color: NAVY } });
  slide.addText("FLEETEL  ·  DIGI-SWITCHRIDE", {
    x: 0.4, y: 0.18, w: 8, h: 0.35, fontSize: 11, color: "A8B3FF", fontFace: "Calibri",
  });
  slide.addText(title, {
    x: 0.4, y: 0.85, w: 12.5, h: 0.4, fontSize: 22, bold: true, color: INK, fontFace: "Calibri",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.4, y: 1.22, w: 12.5, h: 0.28, fontSize: 13, color: MUTED, fontFace: "Calibri",
    });
  }
  const p = img(file);
  const y = 1.55;
  if (p) {
    slide.addImage({ path: p, x: 0.4, y, w: 8.6, h: 5.35, sizing: { type: "contain", w: 8.6, h: 5.35 } });
    if (bullets?.length) {
      slide.addText(bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
        x: 9.2, y, w: 3.7, h: 5.2, fontSize: 13, color: INK, fontFace: "Calibri", valign: "top",
      });
    }
  } else if (bullets?.length) {
    slide.addText(bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
      x: 0.6, y: 1.8, w: 12, h: 4.8, fontSize: 16, color: INK, fontFace: "Calibri",
    });
  }
  footer(slide, page);
}

let n = 1;

{
  const s = pres.addSlide();
  addBg(s, NAVY);
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: BLUE } });
  s.addText("PRESENTED BY FLEETEL", {
    x: 0.7, y: 1.6, w: 11, h: 0.35, fontSize: 14, color: "A8B3FF", fontFace: "Calibri", charSpacing: 2,
  });
  s.addText("Digi-Switchride", {
    x: 0.7, y: 2.05, w: 12, h: 0.9, fontSize: 44, bold: true, color: WHITE, fontFace: "Calibri",
  });
  s.addText("Electric vehicle rental operations for web and mobile", {
    x: 0.7, y: 3.0, w: 11, h: 0.45, fontSize: 20, color: "D6DBF5", fontFace: "Calibri",
  });
  s.addText("Customer presentation  ·  Live product walkthrough with screenshots from the operations portal and rider app", {
    x: 0.7, y: 5.5, w: 11, h: 0.5, fontSize: 14, color: MUTED, fontFace: "Calibri",
  });
  n++;
}

{
  const s = pres.addSlide();
  addBg(s, LIGHT);
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 0.7, fill: { color: NAVY } });
  s.addText("AGENDA", { x: 0.5, y: 0.2, w: 8, h: 0.35, fontSize: 12, color: "A8B3FF", fontFace: "Calibri" });
  s.addText("What we will cover", {
    x: 0.5, y: 1.0, w: 12, h: 0.5, fontSize: 28, bold: true, color: INK, fontFace: "Calibri",
  });
  const items = [
    "Platform overview — one product for operators and riders",
    "Web operations portal — dashboard, fleet, riders, KYC, finance",
    "Live tracking and IoT — GPS, Track360, active rides",
    "Ops desk — bookings, breakdowns, service, support",
    "Multi-company control — organisations, hubs, branding",
    "Rider mobile app — book, pay, vehicle, KYC, support",
    "Delivery model and next steps with Fleetel",
  ];
  s.addText(items.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
    x: 0.7, y: 1.7, w: 11.5, h: 4.8, fontSize: 18, color: INK, fontFace: "Calibri",
  });
  footer(s, n++);
}

{
  const s = pres.addSlide();
  addBg(s, LIGHT);
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 0.7, fill: { color: NAVY } });
  s.addText("PLATFORM", { x: 0.5, y: 0.2, w: 8, h: 0.35, fontSize: 12, color: "A8B3FF", fontFace: "Calibri" });
  s.addText("Digi-Switchride at a glance", {
    x: 0.5, y: 1.0, w: 12, h: 0.45, fontSize: 26, bold: true, color: INK, fontFace: "Calibri",
  });
  const cards = [
    { t: "Web operations portal", d: "Command centre for SuperAdmin and company staff: riders, vehicles, hubs, charging, KYC, bookings, rides, IoT, finance, branding." },
    { t: "Rider mobile app", d: "Android app for login by organisation, wallet, rentals, nearby hubs, UPI/wallet payments, KYC, breakdowns and support." },
    { t: "Telematics & IoT", d: "Track360 pull plus HTTP/TCP/MQTT ingest. Vehicles refresh on the map every 10 seconds. 2/3/4-wheeler icons. Road-aligned live tracking." },
    { t: "Multi-tenant by design", d: "Each customer (company) sees only their hubs, vehicles, riders and devices. SuperAdmin assigns records and company logos." },
  ];
  cards.forEach((c, i) => {
    const x = 0.45 + (i % 2) * 6.4;
    const y = 1.65 + Math.floor(i / 2) * 2.4;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w: 6.1, h: 2.2, fill: { color: WHITE }, rectRadius: 0.12,
    });
    s.addText(c.t, { x: x + 0.25, y: y + 0.25, w: 5.6, h: 0.4, fontSize: 16, bold: true, color: BLUE, fontFace: "Calibri" });
    s.addText(c.d, { x: x + 0.25, y: y + 0.75, w: 5.6, h: 1.2, fontSize: 14, color: INK, fontFace: "Calibri" });
  });
  footer(s, n++);
}

shotSlide(n++, "Secure operations login", "SuperAdmin leaves Organisation empty. Company users pick their company so they never mix fleet data.", "web-login.png", [
  "Role-based sign-in",
  "Company picker for operators",
  "SuperAdmin is not branded with a customer logo",
  "JWT session into the operations desk",
]);

shotSlide(n++, "Management dashboard", "Live KPIs plus every GPS-located vehicle on one map. Locations refresh without resetting zoom.", "web-dashboard.png", [
  "Riders, fleet, KYC, payments",
  "In-ride / reserved at a glance",
  "Map of all located vehicles",
  "Click through to Active Rides",
  "10-second location refresh",
]);

shotSlide(n++, "Rider management", "Create, search and maintain rider accounts with KYC and wallet status.", "web-riders.png", [
  "Name, phone, company",
  "KYC status filters",
  "Account Active / Suspended",
  "Wallet balance",
  "Assign riders to a company",
]);

shotSlide(n++, "Vehicle & fleet", "Registration, class, hub, status, battery and assigned rider.", "web-vehicles.png", [
  "2 / 3 / 4 wheeler classes",
  "E-scooter, e-bike, e-rickshaw, e-car",
  "India registration numbers",
  "Availability and assignment",
  "Linked IoT device",
]);

shotSlide(n++, "Rental hubs", "Hubs are the operating locations. Staff can be limited to assigned hubs.", "web-hubs.png", [
  "Create and locate hubs",
  "Hub-scoped operators",
  "Vehicles sit at a hub",
  "Charging stations attach to hubs",
]);

shotSlide(n++, "Charging stations", "Network of charging points linked to rental hubs.", "web-stations.png", [
  "Station inventory",
  "Operating hours",
  "Company assignment",
  "Visible to riders nearby",
]);

shotSlide(n++, "KYC review", "Approve or reject rider documents before they ride.", "web-kyc.png", [
  "Pending queue",
  "Under review / approved / rejected",
  "Operator workflow",
]);

shotSlide(n++, "Rental plans", "Price books for daily, weekly and monthly EV rentals.", "web-plans.png", [
  "Plan catalogue per company",
  "Shown in the rider app",
  "Linked to bookings",
]);

shotSlide(n++, "Bookings", "Reserve a vehicle at a hub against a plan.", "web-bookings.png", [
  "Create and track bookings",
  "Hub and vehicle assignment",
  "Feeds Active Rides",
]);

shotSlide(n++, "Active rides", "One main map. Vehicle parameters instead of many small maps.", "web-rides.png", [
  "Live ride list",
  "Road-aligned tracking",
  "Battery, speed, status",
  "Sample trail for demos",
]);

shotSlide(n++, "IoT devices", "Track360 devices listed and linked as vehicles automatically.", "web-iot.png", [
  "Device inventory",
  "Pull API sync",
  "Same name as vehicle",
  "Telematics every 10 seconds",
]);

shotSlide(n++, "Breakdowns & command centre", "Riders report issues from the app; operators action them here.", "web-breakdowns.png", [
  "Open tickets",
  "Vehicle and rider context",
  "Company scoped",
]);

shotSlide(n++, "Service requests", "Workshop jobs from riders or staff.", "web-service.png", [
  "Open / in progress",
  "Vehicle history",
]);

shotSlide(n++, "Finance", "Outstanding dues, collections and 30-day revenue.", "web-finance.png", [
  "Dues and wallets",
  "UPI / wallet / cards (provisioned)",
]);

shotSlide(n++, "Organisations (multi-company)", "Fleetel SuperAdmin creates customer companies and assigns data.", "web-tenants.png", [
  "One product, many customers",
  "Isolated riders, fleet, IoT",
  "Company-wise logo",
]);

shotSlide(n++, "Company branding", "Each company uploads its own logo. Product mark stays Digi-Switchride.", "web-branding.png", [
  "SuperAdmin picks company",
  "Logo on company login and header",
  "Never shown on SuperAdmin login",
]);

shotSlide(n++, "Admin users & hub access", "Invite operators, set role, company and hubs they may see.", "web-users.png", [
  "SuperAdmin / Administrator / staff",
  "Hub-restricted lists",
  "Company login shows company name",
]);

{
  const s = pres.addSlide();
  addBg(s, NAVY);
  s.addText("RIDER MOBILE APPLICATION", {
    x: 0.7, y: 2.6, w: 12, h: 0.4, fontSize: 14, color: "A8B3FF", fontFace: "Calibri",
  });
  s.addText("Book, pay, ride and get help", {
    x: 0.7, y: 3.1, w: 12, h: 0.7, fontSize: 32, bold: true, color: WHITE, fontFace: "Calibri",
  });
  s.addText("Android app aligned to the same companies, hubs, vehicles and payments as the web portal.", {
    x: 0.7, y: 3.9, w: 11, h: 0.5, fontSize: 16, color: "D6DBF5", fontFace: "Calibri",
  });
  n++;
}

function mobilePair(page, title, aFile, aCap, bFile, bCap, bullets) {
  const slide = pres.addSlide();
  addBg(slide, LIGHT);
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 0.7, fill: { color: NAVY } });
  slide.addText("RIDER APP", { x: 0.4, y: 0.18, w: 8, h: 0.35, fontSize: 11, color: "A8B3FF", fontFace: "Calibri" });
  slide.addText(title, {
    x: 0.4, y: 0.85, w: 12.5, h: 0.4, fontSize: 22, bold: true, color: INK, fontFace: "Calibri",
  });
  const pa = img(aFile);
  const pb = img(bFile);
  if (pa) slide.addImage({ path: pa, x: 0.5, y: 1.4, w: 3.3, h: 5.5, sizing: { type: "contain", w: 3.3, h: 5.5 } });
  if (pb) slide.addImage({ path: pb, x: 4.0, y: 1.4, w: 3.3, h: 5.5, sizing: { type: "contain", w: 3.3, h: 5.5 } });
  slide.addText(aCap || "", { x: 0.5, y: 6.9, w: 3.3, h: 0.22, fontSize: 11, color: MUTED, align: "center", fontFace: "Calibri" });
  slide.addText(bCap || "", { x: 4.0, y: 6.9, w: 3.3, h: 0.22, fontSize: 11, color: MUTED, align: "center", fontFace: "Calibri" });
  if (bullets?.length) {
    slide.addText(bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
      x: 7.6, y: 1.5, w: 5.2, h: 5, fontSize: 15, color: INK, fontFace: "Calibri", valign: "top",
    });
  }
  footer(slide, page);
}

mobilePair(n++, "Sign in and home", "mobile-login.png", "Organisation login", "mobile-home.png", "Home — wallet, plan, vehicle", [
  "Riders enter their company slug",
  "Home shows wallet, dues, plan",
  "Assigned vehicle and battery",
  "KYC status on the first screen",
]);

mobilePair(n++, "Vehicle, service and payments", "mobile-vehicle.png", "Vehicle & breakdown", "mobile-pay.png", "Pay now", [
  "Report breakdown to Command Centre",
  "Raise a service request",
  "Wallet, UPI, QR, net banking, cards",
  "Payment history",
]);

mobilePair(n++, "Book a ride and more", "mobile-book.png", "Nearby hubs", "mobile-more.png", "More menu", [
  "Nearby hubs with free vehicles",
  "Book & Ride",
  "Profile, agreements & KYC",
  "Charging stations, help, refer & earn",
]);

{
  const s = pres.addSlide();
  addBg(s, LIGHT);
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 13.333, h: 0.7, fill: { color: NAVY } });
  s.addText("CAPABILITY MAP", { x: 0.5, y: 0.2, w: 8, h: 0.35, fontSize: 12, color: "A8B3FF", fontFace: "Calibri" });
  s.addText("Web + mobile, one operational spine", {
    x: 0.5, y: 1.0, w: 12, h: 0.45, fontSize: 24, bold: true, color: INK, fontFace: "Calibri",
  });
  const rows = [
    ["Riders & KYC", "Onboard, approve documents, wallets"],
    ["Fleet", "Vehicles, hubs, charging, 2/3/4-wheeler icons"],
    ["Rentals", "Plans, bookings, active rides"],
    ["Tracking", "All vehicles on one map, 10s refresh, IoT / Track360"],
    ["Service", "Breakdowns, workshop jobs, support tickets"],
    ["Commercial", "Dues, UPI/wallet, promotions, reports"],
    ["Governance", "Companies, hub-scoped users, audit, branding"],
  ];
  rows.forEach((r, i) => {
    const y = 1.6 + i * 0.7;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y, w: 12.3, h: 0.62, fill: { color: WHITE }, rectRadius: 0.08 });
    s.addText(r[0], { x: 0.7, y, w: 3.2, h: 0.62, fontSize: 15, bold: true, color: BLUE, fontFace: "Calibri", valign: "middle" });
    s.addText(r[1], { x: 4.0, y, w: 8.5, h: 0.62, fontSize: 15, color: INK, fontFace: "Calibri", valign: "middle" });
  });
  footer(s, n++);
}

{
  const s = pres.addSlide();
  addBg(s, NAVY);
  s.addText("NEXT STEPS", { x: 0.7, y: 1.8, w: 12, h: 0.35, fontSize: 14, color: "A8B3FF", fontFace: "Calibri" });
  s.addText("Fleetel can stand up your company on Digi-Switchride", {
    x: 0.7, y: 2.25, w: 12, h: 0.7, fontSize: 26, bold: true, color: WHITE, fontFace: "Calibri",
  });
  const steps = [
    "Create your organisation and upload your logo",
    "Import hubs, vehicles and IoT devices (including Track360)",
    "Invite operators with hub-level access",
    "Onboard riders on Android with your company slug",
    "Go live with bookings, tracking, KYC and collections",
  ];
  s.addText(steps.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), {
    x: 0.9, y: 3.2, w: 11, h: 3, fontSize: 18, color: "D6DBF5", fontFace: "Calibri",
  });
  n++;
}

{
  const s = pres.addSlide();
  addBg(s, NAVY);
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: BLUE } });
  s.addText("Thank you", { x: 0.7, y: 2.4, w: 12, h: 0.8, fontSize: 40, bold: true, color: WHITE, fontFace: "Calibri" });
  s.addText("Digi-Switchride  ·  Electric fleet rental, built for Indian operators", {
    x: 0.7, y: 3.3, w: 12, h: 0.4, fontSize: 18, color: "D6DBF5", fontFace: "Calibri",
  });
  s.addText("Presented by Fleetel", {
    x: 0.7, y: 5.4, w: 12, h: 0.4, fontSize: 16, color: BLUE, fontFace: "Calibri",
  });
}

await pres.writeFile({ fileName: out });
console.log("Wrote", out);
