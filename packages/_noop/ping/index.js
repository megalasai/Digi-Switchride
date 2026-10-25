// DigitalOcean App Platform autodetection treats a top-level `packages/`
// folder as Functions. This no-op exists only so a leftover Functions
// component can deploy. It is not used by Digi-Switchride. Delete the
// Functions component in the App Platform UI when you can.
function main() {
  return { body: "ok" };
}

module.exports = { main };
