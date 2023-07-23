import {FilterMixin} from "../../FilterMixin.mjs";
import {SemicolonArrayField} from "../SemicolonArrayField.mjs";

export class SkillIdsField extends FilterMixin(SemicolonArrayField) {
  static name = "skillIds";
  static canExclude = true;
  static template = "modules/babonus/templates/builder_components/text_keys.hbs";

  constructor() {
    super("skillIds", true);
  }

  /** @override */
  static getData(bonus = null) {
    const data = super.getData();
    data.value = bonus ? this.value(bonus).join(";") : null;
    return data;
  }
}
