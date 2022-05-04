export const extend = Object.assign;

export const isObject = (value) => {
  return typeof value === "object" && value !== null;
};

export const isFunction = (value) => {
  return typeof value === "function";
}

export const isArray = Array.isArray;

export const hasOwn = (value, key) => {
  return Object.prototype.hasOwnProperty.call(value, key);
};

export const hasChanged = (newValue, oldValue) => {
  return !Object.is(newValue, oldValue);
};

//  add-foo -> addFoo
export const camelize = (str: string) => {
  return str.replace(/-(\w)/g, (_, c: string) => {
    return c ? c.toUpperCase() : "";
  });
};

//  add -> Add
const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

//  Add --> onAdd
export const toHandlerKey = (str: string) => {
  return str ? "on" + capitalize(str) : "";
};