import { createRouter, createWebHistory } from "vue-router";
import Utils from "./config/utils.js";
import Home from "./views/Home.vue";
import Login from "./views/Login.vue";
import Users from "./views/Users.vue";
import Profile from "./views/Profile.vue";
import VehicleTypes from "./views/VehicleTypes.vue";
import Fleet from "./views/Fleet.vue";

export const routes = [
  {
    path: "/login",
    name: "login",
    component: Login,
  },
  {
    path: "/",
    name: "home",
    component: Home,
  },
  {
    path: "/users",
    name: "users",
    component: Users,
    meta: { roles: ["admin"] },
  },
  {
    path: "/profile",
    name: "profile",
    component: Profile,
  },
  {
    path: "/vehicle-types",
    name: "vehicle-types",
    component: VehicleTypes,
    meta: { roles: ["admin"] },
  },
  {
    path: "/fleet",
    name: "fleet",
    component: Fleet,
    meta: { roles: ["admin", "area_admin"] },
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: { name: "home" },
  },
];

export function authGuard(to) {
  const user = Utils.getStore("user");

  if (!user?.token) {
    return to.name === "login" ? true : { name: "login" };
  }

  if (to.name === "login") {
    return { name: "home" };
  }

  if (to.meta.roles && !to.meta.roles.includes(user.role)) {
    return { name: "home" };
  }

  return true;
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(authGuard);

export default router;
