import { api } from "./api.js";
export const getUser = () => api("/user/progress");
export const getForestProgress = () => api("/user/forest");
export const getChallenges = () => api("/challenges");
export const getBadges = () => api("/user/badges");
export async function completeChallenge(id) {
  const result = await api(`/challenges/${id}/complete`, {
    method: "POST",
    body: {},
  });
  window.dispatchEvent(new CustomEvent("eco:state", { detail: result.state }));
  return result;
}
