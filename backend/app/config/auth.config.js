const authConfig = {
  secret: process.env.AUTH_SECRET || "todo-speckit-dev-secret",
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  allowedEmailDomains: ["oc.edu", "eagles.oc.edu"],
  sessionSeconds: 86400,
};

export default authConfig;
