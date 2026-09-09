import { api } from "./api.js";
export const getUser = () => api("/user/progress");
export const getForestProgress = () => api("/user/forest");
export const getChallenges = () => api("/challenges");
export const getBadges = () => api("/user/badges");
