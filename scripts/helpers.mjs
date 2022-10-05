import { attackTypes, itemsValidForAttackDamageSave, MODULE, targetTypes } from "./constants.mjs";
import { FILTER } from "./filters.mjs";

// Really, really, really slugify a string.
// it may only contain a-z, 0-9, and -.
export function superSlugify(id) {
  const regex = new RegExp(/[^a-z- ]+/gmi);
  let idf = id.replaceAll(regex, "").slugify();
  if (idf.length < 2) return "";
  if (!new RegExp(/[a-z]/).test(idf)) return "";
  return idf;
}

// the types of bonuses ('attack', 'damage', 'save', etc)
export function getTargets() {
  return targetTypes.map(value => {
    const upper = value.toUpperCase();
    const string = `BABONUS.VALUES.TARGET.${upper}`;
    const label = game.i18n.localize(string);
    return { value, label };
  });
}

// current bonuses on the document
export function getBonuses(doc) {
  const flag = doc.getFlag(MODULE, "bonuses");

  if (!flag) return [];

  return targetTypes.reduce((acc, type) => {
    if (!flag[type]) return acc;
    const e = Object.entries(flag[type]);
    const map = e.map(([id, val]) => {
      return {
        identifier: id,
        description: val.description,
        label: val.label,
        type,
        enabled: val.enabled
      };
    });
    acc = acc.concat(map);
    return acc;
  }, []);
}


export class KeyGetter {

  // valid item types; those that can have actions associated.
  static get itemTypes() {
    return itemsValidForAttackDamageSave.map(value => {
      const upper = value.titleCase();
      const string = `DND5E.ItemType${upper}`;
      const label = game.i18n.localize(string);
      return { value, label };
    });
  }

  // base weapon types.
  static get baseWeapons() {
    const entries = Object.entries(CONFIG.DND5E.weaponIds);
    return entries.map(([value, uuid]) => {
      const split = uuid.split(".");
      const id = split.pop();
      const packKey = split.length ? split.join(".") : "dnd5e.items";
      const { index } = game.packs.get(packKey);
      const { name: label } = index.find(({ _id }) => {
        return _id === id;
      }) ?? {};
      return { value, label };
    });
  }

  // the types of damage, as well as healing and temp.
  static get damageTypes() {
    const { damageTypes: d, healingTypes: h } = CONFIG.DND5E;
    const entries = Object.entries(d).concat(Object.entries(h));
    return entries.map(([value, label]) => ({ value, label }));
  }

  // the spell schools available.
  static get spellSchools() {
    const schools = Object.entries(CONFIG.DND5E.spellSchools);
    return schools.map(([value, label]) => ({ value, label }));
  }

  // ability score keys.
  static get abilities() {
    const abilities = Object.entries(CONFIG.DND5E.abilities);
    return abilities.map(([value, label]) => ({ value, label }));
  }

  static get saveAbilities() {
    return this.abilities;
  }

  static get throwTypes() {
    const abl = this.abilities;
    abl.push({
      value: "death",
      label: game.i18n.localize("DND5E.DeathSave")
    });
    return abl;
  }

  // spell component types.
  static get spellComponents() {
    const { spellComponents: s, spellTags: t } = CONFIG.DND5E;
    const entries = Object.entries(s).concat(Object.entries(t));
    return entries.map(([value, { label }]) => ({ value, label }));
  }

  // spell levels.
  static get spellLevels() {
    const levels = Object.entries(CONFIG.DND5E.spellLevels);
    return levels.map(([value, label]) => ({ value, label }));
  }

  // attack types.
  static get attackTypes() {
    const { itemActionTypes } = CONFIG.DND5E;
    const actions = attackTypes;
    return actions.map(value => {
      const label = itemActionTypes[value];
      return { value, label };
    });
  }

  // all weapon properties.
  static get weaponProperties() {
    const prop = Object.entries(CONFIG.DND5E.weaponProperties);
    return prop.map(([value, label]) => ({ value, label }));
  }

  // all status effects.
  static get statusEffects() {
    const effects = CONFIG.statusEffects;
    const ids = effects.reduce((acc, { id }) => {
      if (id) acc.push(id);
      return acc;
    }, []);
    return ids.map((id) => ({ value: id, label: id }));
  }
  static get targetEffects() {
    return this.statusEffects;
  }
}

/**
 * Add bonuses from items. Any item-only filtering happens here,
 * such as checking if the item is currently, and requires being,
 * equipped and/or attuned. Not all valid item types have these
 * properties, such as feature type items.
 */
export function getActorItemBonuses(actor, hookType) {
  const { ATTUNED } = CONFIG.DND5E.attunementTypes;
  const boni = [];

  for (const item of actor.items) {
    const flag = item.getFlag(MODULE, `bonuses.${hookType}`);
    if (!flag) continue;

    const itemBonuses = Object.entries(flag);
    const { equipped, attunement } = item.system;
    const validItemBonuses = itemBonuses.filter(([id, { enabled, itemRequirements }]) => {
      if (!enabled) return false;
      if (!itemRequirements) return true;
      const { equipped: needsEq, attuned: needsAtt } = itemRequirements;
      if (!equipped && needsEq) return false;
      if (attunement !== ATTUNED && needsAtt) return false;
      return true;
    });
    boni.push(...validItemBonuses);
  }
  return boni;
}

/**
 * Add bonuses from effects. Any effect-only filtering happens here,
 * such as checking whether the effect is disabled or unavailable.
 */
export function getActorEffectBonuses(actor, hookType) {
  const boni = [];
  for (const effect of actor.effects) {
    if (effect.disabled || effect.isSuppressed) continue;
    const flag = effect.getFlag(MODULE, `bonuses.${hookType}`);
    if (!flag) continue;
    const effectBonuses = Object.entries(flag);
    const validEffectBonuses = effectBonuses.filter(([id, { enabled }]) => {
      return enabled;
    });
    boni.push(...validEffectBonuses);
  }
  return boni;
}

export function finalFilterBonuses(bonuses, object, type, details = {}) {
  const funcs = FILTER.filterFunctions[type];

  const valids = bonuses.reduce((acc, [id, atts]) => {
    if (!atts.enabled) return acc;
    if (atts.itemTypes) atts.filters["itemTypes"] = atts.itemTypes;
    if (atts.throwTypes) atts.filters["throwTypes"] = atts.throwTypes;

    for (const key in atts.filters) {
      const validity = funcs[key](object, atts.filters[key], details);
      if (!validity) return acc;
    }
    delete atts.filters["itemTypes"];
    delete atts.filters["throwTypes"];
    acc.push(atts.values);
    return acc;
  }, []);
  return valids;
}
