import { api, escapeHTML as esc, errorState, toast } from "./api.js";
export async function initShop(container, world) {
  let state;
  async function refresh() {
    state = await api("/user/shop");
    world?.setDecorations(
      state.placements.map((p) => ({
        ...p,
        ...state.catalog.find((i) => i.id === p.item_id),
      })),
    );
    render();
  }
  function render() {
    container.innerHTML = `<div class="feature-heading"><div><p class="eyebrow">MAKE IT YOURS</p><h2>The forest workshop.</h2><p>Buy each item once, then move it between six clearings. Purchases never reduce your forest level.</p></div><div class="wallet-balance"><strong>${state.wallet.balance}</strong><span>Spendable points</span><small>${state.wallet.lifetime} lifetime · ${state.wallet.bonuses} quest bonuses · ${state.wallet.spent} spent</small></div></div><div class="clearing-grid">${Array.from(
      { length: 6 },
      (_, slot) => {
        const p = state.placements.find((p) => p.slot === slot),
          item = state.catalog.find((i) => i.id === p?.item_id);
        return `<div class="clearing ${p ? "occupied" : ""}"><span>Clearing ${slot + 1}</span><strong>${item ? esc(item.name) : "Open space"}</strong>${p ? `<button class="text-button" data-remove-slot="${slot}">Remove</button>` : ""}</div>`;
      },
    ).join("")}</div><div class="shop-grid">${state.catalog
      .map((item) => {
        const owned = state.owned.includes(item.id),
          placement = state.placements.find((p) => p.item_id === item.id);
        return `<article class="shop-item"><span class="item-swatch" style="--item-color:#${item.color.toString(16).padStart(6, "0")}">${{ tree: "♧", fern: "❧", flowers: "✿", pond: "≈", lantern: "✧" }[item.kind]}</span><div><span class="eyebrow">${owned ? "IN YOUR COLLECTION" : item.cost + " POINTS"}</span><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p></div>${owned ? `<div class="placement-controls"><label>Choose a clearing<select data-item-slot="${item.id}">${Array.from({ length: 6 }, (_, slot) => `<option value="${slot}" ${placement?.slot === slot ? "selected" : ""}>Clearing ${slot + 1}${state.placements.some((p) => p.slot === slot && p.item_id !== item.id) ? " (occupied)" : ""}</option>`).join("")}</select></label><button class="button button-dark" data-place="${item.id}">Place ↗</button></div>` : `<button class="button button-dark" data-buy="${item.id}" ${state.wallet.balance < item.cost ? "disabled" : ""}>${state.wallet.balance < item.cost ? `${item.cost - state.wallet.balance} more points needed` : "Buy for " + item.cost + " points"}</button>`}</article>`;
      })
      .join("")}</div>`;
    container.querySelectorAll("[data-buy]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          try {
            await api("/user/shop/" + b.dataset.buy + "/buy", {
              method: "POST",
              body: {},
            });
            toast("Added to your collection. Choose a clearing to plant it.");
            await refresh();
          } catch (e) {
            toast(e.message);
            b.disabled = false;
          }
        }),
    );
    const save = async (placements, b) => {
      b.disabled = true;
      try {
        await api("/user/forest/layout", {
          method: "PUT",
          body: {
            placements: placements.map(({ item_id, slot }) => ({
              item_id,
              slot,
            })),
          },
        });
        await refresh();
        toast("Your forest layout is saved.");
      } catch (e) {
        toast(e.message);
        b.disabled = false;
      }
    };
    container.querySelectorAll("[data-place]").forEach(
      (b) =>
        (b.onclick = () => {
          const item_id = b.dataset.place,
            slot = Number(
              container.querySelector(`[data-item-slot="${item_id}"]`).value,
            );
          if (
            state.placements.some(
              (p) => p.slot === slot && p.item_id !== item_id,
            )
          ) {
            toast(
              "That clearing is occupied. Remove its item or choose another clearing.",
            );
            return;
          }
          save(
            [
              ...state.placements.filter((p) => p.item_id !== item_id),
              { item_id, slot },
            ],
            b,
          );
        }),
    );
    container.querySelectorAll("[data-remove-slot]").forEach(
      (b) =>
        (b.onclick = () =>
          save(
            state.placements.filter(
              (p) => p.slot !== Number(b.dataset.removeSlot),
            ),
            b,
          )),
    );
  }
  try {
    await refresh();
  } catch (e) {
    errorState(container, e);
  }
}
