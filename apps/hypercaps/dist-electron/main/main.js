"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const fs = require("fs/promises");
var NOTHING = Symbol.for("immer-nothing");
var DRAFTABLE = Symbol.for("immer-draftable");
var DRAFT_STATE = Symbol.for("immer-state");
var errors = process.env.NODE_ENV !== "production" ? [
  // All error codes, starting by 0:
  function(plugin) {
    return `The plugin for '${plugin}' has not been loaded into Immer. To enable the plugin, import and call \`enable${plugin}()\` when initializing your application.`;
  },
  function(thing) {
    return `produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got '${thing}'`;
  },
  "This object has been frozen and should not be mutated",
  function(data) {
    return "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? " + data;
  },
  "An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.",
  "Immer forbids circular references",
  "The first or second argument to `produce` must be a function",
  "The third argument to `produce` must be a function or undefined",
  "First argument to `createDraft` must be a plain object, an array, or an immerable object",
  "First argument to `finishDraft` must be a draft returned by `createDraft`",
  function(thing) {
    return `'current' expects a draft, got: ${thing}`;
  },
  "Object.defineProperty() cannot be used on an Immer draft",
  "Object.setPrototypeOf() cannot be used on an Immer draft",
  "Immer only supports deleting array indices",
  "Immer only supports setting array indices and the 'length' property",
  function(thing) {
    return `'original' expects a draft, got: ${thing}`;
  }
  // Note: if more errors are added, the errorOffset in Patches.ts should be increased
  // See Patches.ts for additional errors
] : [];
function die(error, ...args) {
  if (process.env.NODE_ENV !== "production") {
    const e = errors[error];
    const msg = typeof e === "function" ? e.apply(null, args) : e;
    throw new Error(`[Immer] ${msg}`);
  }
  throw new Error(
    `[Immer] minified error nr: ${error}. Full error at: https://bit.ly/3cXEKWf`
  );
}
var getPrototypeOf = Object.getPrototypeOf;
function isDraft(value) {
  return !!value && !!value[DRAFT_STATE];
}
function isDraftable(value) {
  var _a;
  if (!value)
    return false;
  return isPlainObject(value) || Array.isArray(value) || !!value[DRAFTABLE] || !!((_a = value.constructor) == null ? void 0 : _a[DRAFTABLE]) || isMap(value) || isSet(value);
}
var objectCtorString = Object.prototype.constructor.toString();
function isPlainObject(value) {
  if (!value || typeof value !== "object")
    return false;
  const proto = getPrototypeOf(value);
  if (proto === null) {
    return true;
  }
  const Ctor = Object.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  if (Ctor === Object)
    return true;
  return typeof Ctor == "function" && Function.toString.call(Ctor) === objectCtorString;
}
function each(obj, iter) {
  if (getArchtype(obj) === 0) {
    Reflect.ownKeys(obj).forEach((key) => {
      iter(key, obj[key], obj);
    });
  } else {
    obj.forEach((entry, index) => iter(index, entry, obj));
  }
}
function getArchtype(thing) {
  const state = thing[DRAFT_STATE];
  return state ? state.type_ : Array.isArray(thing) ? 1 : isMap(thing) ? 2 : isSet(thing) ? 3 : 0;
}
function has(thing, prop) {
  return getArchtype(thing) === 2 ? thing.has(prop) : Object.prototype.hasOwnProperty.call(thing, prop);
}
function set(thing, propOrOldValue, value) {
  const t = getArchtype(thing);
  if (t === 2)
    thing.set(propOrOldValue, value);
  else if (t === 3) {
    thing.add(value);
  } else
    thing[propOrOldValue] = value;
}
function is(x, y) {
  if (x === y) {
    return x !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}
function isMap(target) {
  return target instanceof Map;
}
function isSet(target) {
  return target instanceof Set;
}
function latest(state) {
  return state.copy_ || state.base_;
}
function shallowCopy(base, strict) {
  if (isMap(base)) {
    return new Map(base);
  }
  if (isSet(base)) {
    return new Set(base);
  }
  if (Array.isArray(base))
    return Array.prototype.slice.call(base);
  const isPlain = isPlainObject(base);
  if (strict === true || strict === "class_only" && !isPlain) {
    const descriptors = Object.getOwnPropertyDescriptors(base);
    delete descriptors[DRAFT_STATE];
    let keys = Reflect.ownKeys(descriptors);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const desc = descriptors[key];
      if (desc.writable === false) {
        desc.writable = true;
        desc.configurable = true;
      }
      if (desc.get || desc.set)
        descriptors[key] = {
          configurable: true,
          writable: true,
          // could live with !!desc.set as well here...
          enumerable: desc.enumerable,
          value: base[key]
        };
    }
    return Object.create(getPrototypeOf(base), descriptors);
  } else {
    const proto = getPrototypeOf(base);
    if (proto !== null && isPlain) {
      return { ...base };
    }
    const obj = Object.create(proto);
    return Object.assign(obj, base);
  }
}
function freeze(obj, deep = false) {
  if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj))
    return obj;
  if (getArchtype(obj) > 1) {
    obj.set = obj.add = obj.clear = obj.delete = dontMutateFrozenCollections;
  }
  Object.freeze(obj);
  if (deep)
    Object.entries(obj).forEach(([key, value]) => freeze(value, true));
  return obj;
}
function dontMutateFrozenCollections() {
  die(2);
}
function isFrozen(obj) {
  return Object.isFrozen(obj);
}
var plugins = {};
function getPlugin(pluginKey) {
  const plugin = plugins[pluginKey];
  if (!plugin) {
    die(0, pluginKey);
  }
  return plugin;
}
var currentScope;
function getCurrentScope() {
  return currentScope;
}
function createScope(parent_, immer_) {
  return {
    drafts_: [],
    parent_,
    immer_,
    // Whenever the modified draft contains a draft from another scope, we
    // need to prevent auto-freezing so the unowned draft can be finalized.
    canAutoFreeze_: true,
    unfinalizedDrafts_: 0
  };
}
function usePatchesInScope(scope, patchListener) {
  if (patchListener) {
    getPlugin("Patches");
    scope.patches_ = [];
    scope.inversePatches_ = [];
    scope.patchListener_ = patchListener;
  }
}
function revokeScope(scope) {
  leaveScope(scope);
  scope.drafts_.forEach(revokeDraft);
  scope.drafts_ = null;
}
function leaveScope(scope) {
  if (scope === currentScope) {
    currentScope = scope.parent_;
  }
}
function enterScope(immer2) {
  return currentScope = createScope(currentScope, immer2);
}
function revokeDraft(draft) {
  const state = draft[DRAFT_STATE];
  if (state.type_ === 0 || state.type_ === 1)
    state.revoke_();
  else
    state.revoked_ = true;
}
function processResult(result, scope) {
  scope.unfinalizedDrafts_ = scope.drafts_.length;
  const baseDraft = scope.drafts_[0];
  const isReplaced = result !== void 0 && result !== baseDraft;
  if (isReplaced) {
    if (baseDraft[DRAFT_STATE].modified_) {
      revokeScope(scope);
      die(4);
    }
    if (isDraftable(result)) {
      result = finalize(scope, result);
      if (!scope.parent_)
        maybeFreeze(scope, result);
    }
    if (scope.patches_) {
      getPlugin("Patches").generateReplacementPatches_(
        baseDraft[DRAFT_STATE].base_,
        result,
        scope.patches_,
        scope.inversePatches_
      );
    }
  } else {
    result = finalize(scope, baseDraft, []);
  }
  revokeScope(scope);
  if (scope.patches_) {
    scope.patchListener_(scope.patches_, scope.inversePatches_);
  }
  return result !== NOTHING ? result : void 0;
}
function finalize(rootScope, value, path2) {
  if (isFrozen(value))
    return value;
  const state = value[DRAFT_STATE];
  if (!state) {
    each(
      value,
      (key, childValue) => finalizeProperty(rootScope, state, value, key, childValue, path2)
    );
    return value;
  }
  if (state.scope_ !== rootScope)
    return value;
  if (!state.modified_) {
    maybeFreeze(rootScope, state.base_, true);
    return state.base_;
  }
  if (!state.finalized_) {
    state.finalized_ = true;
    state.scope_.unfinalizedDrafts_--;
    const result = state.copy_;
    let resultEach = result;
    let isSet2 = false;
    if (state.type_ === 3) {
      resultEach = new Set(result);
      result.clear();
      isSet2 = true;
    }
    each(
      resultEach,
      (key, childValue) => finalizeProperty(rootScope, state, result, key, childValue, path2, isSet2)
    );
    maybeFreeze(rootScope, result, false);
    if (path2 && rootScope.patches_) {
      getPlugin("Patches").generatePatches_(
        state,
        path2,
        rootScope.patches_,
        rootScope.inversePatches_
      );
    }
  }
  return state.copy_;
}
function finalizeProperty(rootScope, parentState, targetObject, prop, childValue, rootPath, targetIsSet) {
  if (process.env.NODE_ENV !== "production" && childValue === targetObject)
    die(5);
  if (isDraft(childValue)) {
    const path2 = rootPath && parentState && parentState.type_ !== 3 && // Set objects are atomic since they have no keys.
    !has(parentState.assigned_, prop) ? rootPath.concat(prop) : void 0;
    const res = finalize(rootScope, childValue, path2);
    set(targetObject, prop, res);
    if (isDraft(res)) {
      rootScope.canAutoFreeze_ = false;
    } else
      return;
  } else if (targetIsSet) {
    targetObject.add(childValue);
  }
  if (isDraftable(childValue) && !isFrozen(childValue)) {
    if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) {
      return;
    }
    finalize(rootScope, childValue);
    if ((!parentState || !parentState.scope_.parent_) && typeof prop !== "symbol" && Object.prototype.propertyIsEnumerable.call(targetObject, prop))
      maybeFreeze(rootScope, childValue);
  }
}
function maybeFreeze(scope, value, deep = false) {
  if (!scope.parent_ && scope.immer_.autoFreeze_ && scope.canAutoFreeze_) {
    freeze(value, deep);
  }
}
function createProxyProxy(base, parent) {
  const isArray = Array.isArray(base);
  const state = {
    type_: isArray ? 1 : 0,
    // Track which produce call this is associated with.
    scope_: parent ? parent.scope_ : getCurrentScope(),
    // True for both shallow and deep changes.
    modified_: false,
    // Used during finalization.
    finalized_: false,
    // Track which properties have been assigned (true) or deleted (false).
    assigned_: {},
    // The parent draft state.
    parent_: parent,
    // The base state.
    base_: base,
    // The base proxy.
    draft_: null,
    // set below
    // The base copy with any updated values.
    copy_: null,
    // Called by the `produce` function.
    revoke_: null,
    isManual_: false
  };
  let target = state;
  let traps = objectTraps;
  if (isArray) {
    target = [state];
    traps = arrayTraps;
  }
  const { revoke, proxy } = Proxy.revocable(target, traps);
  state.draft_ = proxy;
  state.revoke_ = revoke;
  return proxy;
}
var objectTraps = {
  get(state, prop) {
    if (prop === DRAFT_STATE)
      return state;
    const source = latest(state);
    if (!has(source, prop)) {
      return readPropFromProto(state, source, prop);
    }
    const value = source[prop];
    if (state.finalized_ || !isDraftable(value)) {
      return value;
    }
    if (value === peek(state.base_, prop)) {
      prepareCopy(state);
      return state.copy_[prop] = createProxy(value, state);
    }
    return value;
  },
  has(state, prop) {
    return prop in latest(state);
  },
  ownKeys(state) {
    return Reflect.ownKeys(latest(state));
  },
  set(state, prop, value) {
    const desc = getDescriptorFromProto(latest(state), prop);
    if (desc == null ? void 0 : desc.set) {
      desc.set.call(state.draft_, value);
      return true;
    }
    if (!state.modified_) {
      const current2 = peek(latest(state), prop);
      const currentState = current2 == null ? void 0 : current2[DRAFT_STATE];
      if (currentState && currentState.base_ === value) {
        state.copy_[prop] = value;
        state.assigned_[prop] = false;
        return true;
      }
      if (is(value, current2) && (value !== void 0 || has(state.base_, prop)))
        return true;
      prepareCopy(state);
      markChanged(state);
    }
    if (state.copy_[prop] === value && // special case: handle new props with value 'undefined'
    (value !== void 0 || prop in state.copy_) || // special case: NaN
    Number.isNaN(value) && Number.isNaN(state.copy_[prop]))
      return true;
    state.copy_[prop] = value;
    state.assigned_[prop] = true;
    return true;
  },
  deleteProperty(state, prop) {
    if (peek(state.base_, prop) !== void 0 || prop in state.base_) {
      state.assigned_[prop] = false;
      prepareCopy(state);
      markChanged(state);
    } else {
      delete state.assigned_[prop];
    }
    if (state.copy_) {
      delete state.copy_[prop];
    }
    return true;
  },
  // Note: We never coerce `desc.value` into an Immer draft, because we can't make
  // the same guarantee in ES5 mode.
  getOwnPropertyDescriptor(state, prop) {
    const owner = latest(state);
    const desc = Reflect.getOwnPropertyDescriptor(owner, prop);
    if (!desc)
      return desc;
    return {
      writable: true,
      configurable: state.type_ !== 1 || prop !== "length",
      enumerable: desc.enumerable,
      value: owner[prop]
    };
  },
  defineProperty() {
    die(11);
  },
  getPrototypeOf(state) {
    return getPrototypeOf(state.base_);
  },
  setPrototypeOf() {
    die(12);
  }
};
var arrayTraps = {};
each(objectTraps, (key, fn) => {
  arrayTraps[key] = function() {
    arguments[0] = arguments[0][0];
    return fn.apply(this, arguments);
  };
});
arrayTraps.deleteProperty = function(state, prop) {
  if (process.env.NODE_ENV !== "production" && isNaN(parseInt(prop)))
    die(13);
  return arrayTraps.set.call(this, state, prop, void 0);
};
arrayTraps.set = function(state, prop, value) {
  if (process.env.NODE_ENV !== "production" && prop !== "length" && isNaN(parseInt(prop)))
    die(14);
  return objectTraps.set.call(this, state[0], prop, value, state[0]);
};
function peek(draft, prop) {
  const state = draft[DRAFT_STATE];
  const source = state ? latest(state) : draft;
  return source[prop];
}
function readPropFromProto(state, source, prop) {
  var _a;
  const desc = getDescriptorFromProto(source, prop);
  return desc ? `value` in desc ? desc.value : (
    // This is a very special case, if the prop is a getter defined by the
    // prototype, we should invoke it with the draft as context!
    (_a = desc.get) == null ? void 0 : _a.call(state.draft_)
  ) : void 0;
}
function getDescriptorFromProto(source, prop) {
  if (!(prop in source))
    return void 0;
  let proto = getPrototypeOf(source);
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (desc)
      return desc;
    proto = getPrototypeOf(proto);
  }
  return void 0;
}
function markChanged(state) {
  if (!state.modified_) {
    state.modified_ = true;
    if (state.parent_) {
      markChanged(state.parent_);
    }
  }
}
function prepareCopy(state) {
  if (!state.copy_) {
    state.copy_ = shallowCopy(
      state.base_,
      state.scope_.immer_.useStrictShallowCopy_
    );
  }
}
var Immer2 = class {
  constructor(config) {
    this.autoFreeze_ = true;
    this.useStrictShallowCopy_ = false;
    this.produce = (base, recipe, patchListener) => {
      if (typeof base === "function" && typeof recipe !== "function") {
        const defaultBase = recipe;
        recipe = base;
        const self = this;
        return function curriedProduce(base2 = defaultBase, ...args) {
          return self.produce(base2, (draft) => recipe.call(this, draft, ...args));
        };
      }
      if (typeof recipe !== "function")
        die(6);
      if (patchListener !== void 0 && typeof patchListener !== "function")
        die(7);
      let result;
      if (isDraftable(base)) {
        const scope = enterScope(this);
        const proxy = createProxy(base, void 0);
        let hasError = true;
        try {
          result = recipe(proxy);
          hasError = false;
        } finally {
          if (hasError)
            revokeScope(scope);
          else
            leaveScope(scope);
        }
        usePatchesInScope(scope, patchListener);
        return processResult(result, scope);
      } else if (!base || typeof base !== "object") {
        result = recipe(base);
        if (result === void 0)
          result = base;
        if (result === NOTHING)
          result = void 0;
        if (this.autoFreeze_)
          freeze(result, true);
        if (patchListener) {
          const p = [];
          const ip = [];
          getPlugin("Patches").generateReplacementPatches_(base, result, p, ip);
          patchListener(p, ip);
        }
        return result;
      } else
        die(1, base);
    };
    this.produceWithPatches = (base, recipe) => {
      if (typeof base === "function") {
        return (state, ...args) => this.produceWithPatches(state, (draft) => base(draft, ...args));
      }
      let patches, inversePatches;
      const result = this.produce(base, recipe, (p, ip) => {
        patches = p;
        inversePatches = ip;
      });
      return [result, patches, inversePatches];
    };
    if (typeof (config == null ? void 0 : config.autoFreeze) === "boolean")
      this.setAutoFreeze(config.autoFreeze);
    if (typeof (config == null ? void 0 : config.useStrictShallowCopy) === "boolean")
      this.setUseStrictShallowCopy(config.useStrictShallowCopy);
  }
  createDraft(base) {
    if (!isDraftable(base))
      die(8);
    if (isDraft(base))
      base = current(base);
    const scope = enterScope(this);
    const proxy = createProxy(base, void 0);
    proxy[DRAFT_STATE].isManual_ = true;
    leaveScope(scope);
    return proxy;
  }
  finishDraft(draft, patchListener) {
    const state = draft && draft[DRAFT_STATE];
    if (!state || !state.isManual_)
      die(9);
    const { scope_: scope } = state;
    usePatchesInScope(scope, patchListener);
    return processResult(void 0, scope);
  }
  /**
   * Pass true to automatically freeze all copies created by Immer.
   *
   * By default, auto-freezing is enabled.
   */
  setAutoFreeze(value) {
    this.autoFreeze_ = value;
  }
  /**
   * Pass true to enable strict shallow copy.
   *
   * By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
   */
  setUseStrictShallowCopy(value) {
    this.useStrictShallowCopy_ = value;
  }
  applyPatches(base, patches) {
    let i;
    for (i = patches.length - 1; i >= 0; i--) {
      const patch = patches[i];
      if (patch.path.length === 0 && patch.op === "replace") {
        base = patch.value;
        break;
      }
    }
    if (i > -1) {
      patches = patches.slice(i + 1);
    }
    const applyPatchesImpl = getPlugin("Patches").applyPatches_;
    if (isDraft(base)) {
      return applyPatchesImpl(base, patches);
    }
    return this.produce(
      base,
      (draft) => applyPatchesImpl(draft, patches)
    );
  }
};
function createProxy(value, parent) {
  const draft = isMap(value) ? getPlugin("MapSet").proxyMap_(value, parent) : isSet(value) ? getPlugin("MapSet").proxySet_(value, parent) : createProxyProxy(value, parent);
  const scope = parent ? parent.scope_ : getCurrentScope();
  scope.drafts_.push(draft);
  return draft;
}
function current(value) {
  if (!isDraft(value))
    die(10, value);
  return currentImpl(value);
}
function currentImpl(value) {
  if (!isDraftable(value) || isFrozen(value))
    return value;
  const state = value[DRAFT_STATE];
  let copy;
  if (state) {
    if (!state.modified_)
      return state.base_;
    state.finalized_ = true;
    copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_);
  } else {
    copy = shallowCopy(value, true);
  }
  each(copy, (key, childValue) => {
    set(copy, key, currentImpl(childValue));
  });
  if (state) {
    state.finalized_ = false;
  }
  return copy;
}
var immer = new Immer2();
var produce = immer.produce;
immer.produceWithPatches.bind(
  immer
);
immer.setAutoFreeze.bind(immer);
immer.setUseStrictShallowCopy.bind(immer);
immer.applyPatches.bind(immer);
immer.createDraft.bind(immer);
immer.finishDraft.bind(immer);
const DEFAULT_STATE = {
  startupOnBoot: false,
  enableOnStartup: true,
  features: [
    {
      name: "hyperKey",
      isFeatureEnabled: true,
      config: {
        enableOnStartup: true,
        isHyperKeyEnabled: true,
        trigger: "CapsLock",
        modifiers: ["LShiftKey"]
      }
    }
  ]
};
const _Store = class _Store {
  constructor() {
    __publicField(this, "state");
    __publicField(this, "filePath");
    this.filePath = path.join(electron.app.getPath("userData"), "state.json");
    this.state = DEFAULT_STATE;
  }
  static getInstance() {
    if (!_Store.instance) {
      _Store.instance = new _Store();
    }
    return _Store.instance;
  }
  async load() {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      this.state = JSON.parse(data);
    } catch (error) {
      await this.save();
    }
  }
  async save() {
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error("Failed to save state:", error);
    }
  }
  // Generic state update method using Immer
  async update(recipe) {
    this.state = produce(this.state, recipe);
    await this.save();
  }
  // Convenience methods
  getState() {
    return this.state;
  }
  async getFeature(name) {
    return this.state.features.find((f) => f.name === name);
  }
  // Startup settings with electron integration
  async setStartupOnBoot(enabled) {
    await this.update((draft) => {
      draft.startupOnBoot = enabled;
    });
    electron.app.setLoginItemSettings({
      openAtLogin: enabled,
      path: enabled ? electron.app.getPath("exe") : void 0
    });
  }
};
__publicField(_Store, "instance");
let Store = _Store;
class KeyboardService {
  constructor() {
    __publicField(this, "mainWindow", null);
    __publicField(this, "keyboardProcess", null);
    __publicField(this, "store");
    __publicField(this, "startupTimeout", null);
    __publicField(this, "state", {
      isListening: false,
      isLoading: false,
      isStarting: false
    });
    __publicField(this, "handleKeyboardOutput", (data) => {
      var _a;
      try {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith("[DEBUG]")) {
            console.log(trimmed);
            continue;
          }
          try {
            const state = JSON.parse(trimmed);
            const keyboardState = {
              pressedKeys: Array.isArray(state.pressedKeys) ? state.pressedKeys : [],
              timestamp: Date.now()
            };
            (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("keyboard-event", keyboardState);
          } catch (parseError) {
            if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
              console.error("Error parsing keyboard state:", parseError);
            }
          }
        }
      } catch (error) {
        console.error("Error handling keyboard output:", error);
      }
    });
    this.store = Store.getInstance();
  }
  getScriptPath() {
    const scriptName = "keyboard-monitor.ps1";
    const scriptSubPath = path.join(
      "electron",
      "features",
      "hyperkeys",
      "scripts",
      scriptName
    );
    return process.env.NODE_ENV === "development" ? path.join(electron.app.getAppPath(), scriptSubPath) : path.join(process.resourcesPath, scriptSubPath);
  }
  setState(updates) {
    var _a;
    this.state = { ...this.state, ...updates };
    (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("keyboard-service-state", {
      ...this.state,
      isRunning: this.isRunning()
    });
  }
  getState() {
    return { ...this.state };
  }
  async init() {
    var _a;
    await this.store.load();
    const hyperKeyFeature = await this.store.getFeature("hyperKey");
    console.log("[KeyboardService] : HyperKeyFeature init()", hyperKeyFeature);
    if (!hyperKeyFeature) {
      this.setState({
        error: "HyperKey feature not found",
        lastError: {
          message: "HyperKey feature not found",
          timestamp: Date.now()
        }
      });
      throw new Error("HyperKey feature not found");
    }
    (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("hyperkey-state", hyperKeyFeature);
    if (hyperKeyFeature.isFeatureEnabled) {
      await this.startListening();
    }
  }
  setMainWindow(window) {
    this.mainWindow = window;
  }
  async notifyStateUpdate() {
    var _a;
    const hyperKeyFeature = await this.store.getFeature("hyperKey");
    if (hyperKeyFeature) {
      (_a = this.mainWindow) == null ? void 0 : _a.webContents.send("hyperkey-state", {
        ...hyperKeyFeature.config,
        enabled: hyperKeyFeature.isFeatureEnabled
      });
    }
  }
  async startListening() {
    console.log("[KeyboardService] startListening() called");
    if (this.keyboardProcess) {
      console.log("[KeyboardService] Process already running, returning early");
      return;
    }
    if (this.state.isStarting) {
      console.log("[KeyboardService] Process already starting, waiting...");
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.state.isStarting) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
      if (this.keyboardProcess) return;
    }
    this.setState({
      isLoading: true,
      isStarting: true,
      lastStartAttempt: Date.now(),
      error: void 0,
      lastError: void 0,
      isListening: false
    });
    try {
      const scriptPath = this.getScriptPath();
      const hyperKeyFeature = await this.store.getFeature("hyperKey");
      if (!hyperKeyFeature) {
        throw new Error("Failed to get hyperkey feature");
      }
      const config = {
        isEnabled: hyperKeyFeature.isFeatureEnabled,
        isHyperKeyEnabled: hyperKeyFeature.config.isHyperKeyEnabled,
        trigger: hyperKeyFeature.config.trigger,
        modifiers: hyperKeyFeature.config.modifiers || [],
        capsLockBehavior: hyperKeyFeature.config.capsLockBehavior || "BlockToggle"
      };
      const command = [
        // Enable debug output and set error preferences
        "$ProgressPreference = 'SilentlyContinue';",
        "$ErrorActionPreference = 'Stop';",
        "Write-Host '[DEBUG] Starting keyboard monitor...';",
        // Set up config
        "$Config = @{",
        `  isEnabled=$${config.isEnabled.toString().toLowerCase()};`,
        `  isHyperKeyEnabled=$${config.isHyperKeyEnabled.toString().toLowerCase()};`,
        `  trigger='${config.trigger}';`,
        `  modifiers=@(${config.modifiers.map((m) => `'${m}'`).join(",") || "@()"});`,
        `  capsLockBehavior='${config.capsLockBehavior}';`,
        "};",
        // Debug output config
        "Write-Host '[DEBUG] Config:' ($Config | ConvertTo-Json -Depth 10);",
        // Execute script with proper error handling
        "try {",
        `  Set-Location '${path.dirname(scriptPath)}';`,
        `  . '${scriptPath}';`,
        "} catch {",
        "  Write-Error $_.Exception.Message;",
        "  Write-Error $_.ScriptStackTrace;",
        "  exit 1;",
        "}"
      ].join(" ");
      console.log("[KeyboardService] command", command);
      console.log("[KeyboardService] Spawning process with command:", command);
      console.log("[KeyboardService] Script path:", scriptPath);
      console.log("[KeyboardService] Process env:", process.env.NODE_ENV);
      const fs2 = require("fs");
      if (!fs2.existsSync(scriptPath)) {
        throw new Error(`Script not found at path: ${scriptPath}`);
      }
      console.log("[KeyboardService] Script exists at path");
      this.keyboardProcess = child_process.spawn("powershell.exe", [
        "-ExecutionPolicy",
        "Bypass",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        command
      ]);
      if (!this.keyboardProcess.pid) {
        throw new Error("Failed to start PowerShell process");
      }
      console.log(
        "[KeyboardService] Process started with PID:",
        this.keyboardProcess.pid
      );
      await this.setupProcessListeners();
      this.setState({
        isListening: true,
        isLoading: false
      });
      console.log("[KeyboardService] State updated");
      await this.notifyStateUpdate();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error during startup";
      this.setState({
        isStarting: false,
        error: errorMessage,
        lastError: {
          message: errorMessage,
          timestamp: Date.now()
        }
      });
      this.handleStartupFailure(errorMessage);
    }
  }
  async setupProcessListeners() {
    if (!this.keyboardProcess) {
      console.log("[KeyboardService] Process not found, returning early");
      return;
    }
    console.log("[KeyboardService] Setting up process listeners");
    return new Promise((resolve, reject) => {
      var _a, _b;
      let hasReceivedInitialData = false;
      const cleanup = () => {
        var _a2, _b2;
        console.log("[KeyboardService] Cleaning up listeners");
        if (this.keyboardProcess) {
          (_a2 = this.keyboardProcess.stdout) == null ? void 0 : _a2.removeAllListeners();
          (_b2 = this.keyboardProcess.stderr) == null ? void 0 : _b2.removeAllListeners();
          this.keyboardProcess.removeAllListeners();
        }
      };
      this.keyboardProcess.on("error", (error) => {
        console.error("[KeyboardService] Process error:", error);
        cleanup();
        reject(error);
      });
      (_a = this.keyboardProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
        const output = data.toString();
        console.log("[KeyboardService] Raw stdout:", output);
        if (!hasReceivedInitialData) {
          console.log("[KeyboardService] Received initial data");
          hasReceivedInitialData = true;
          this.clearStartupState();
          resolve();
        }
        this.handleKeyboardOutput(data);
      });
      (_b = this.keyboardProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
        const error = data.toString();
        console.error("[KeyboardService] stderr:", error);
        if (!hasReceivedInitialData) {
          cleanup();
          reject(new Error(error));
        }
      });
      this.keyboardProcess.on("close", (code, signal) => {
        console.log(
          "[KeyboardService] Process closed with code:",
          code,
          "signal:",
          signal
        );
        cleanup();
        this.keyboardProcess = null;
        this.setState({
          isListening: false,
          isLoading: false,
          error: code !== 0 ? `Process exited with code ${code}` : void 0
        });
        if (!hasReceivedInitialData) {
          reject(
            new Error(`Process exited with code ${code} before sending data`)
          );
        }
      });
      const timeout = setTimeout(() => {
        if (!hasReceivedInitialData) {
          console.error("[KeyboardService] Timeout waiting for initial data");
          cleanup();
          reject(new Error("Timeout waiting for initial data"));
        }
      }, 5e3);
      Promise.race([
        new Promise((_, timeoutReject) => {
          timeout.unref();
        }),
        new Promise((successResolve) => {
          const checkInterval = setInterval(() => {
            if (hasReceivedInitialData) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              successResolve();
            }
          }, 100);
        })
      ]).catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  clearStartupState() {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }
    this.setState({
      isLoading: false,
      isStarting: false
    });
  }
  handleStartupFailure(message) {
    this.clearStartupState();
    if (this.keyboardProcess) {
      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
    this.setState({
      isListening: false,
      error: message,
      lastError: {
        message,
        timestamp: Date.now()
      }
    });
    electron.dialog.showErrorBox(
      "Keyboard Monitor Error",
      `Failed to start keyboard monitor: ${message}`
    );
  }
  async stopListening() {
    var _a, _b;
    if (this.keyboardProcess) {
      (_a = this.keyboardProcess.stdout) == null ? void 0 : _a.removeAllListeners();
      (_b = this.keyboardProcess.stderr) == null ? void 0 : _b.removeAllListeners();
      this.keyboardProcess.removeAllListeners();
      this.keyboardProcess.kill();
      this.keyboardProcess = null;
    }
    this.setState({
      isListening: false,
      isLoading: false,
      error: void 0
    });
    await this.notifyStateUpdate();
  }
  async restartWithConfig(config) {
    await this.store.update((draft) => {
      const feature = draft.features.find((f) => f.name === "hyperKey");
      if (feature) {
        feature.config = config;
      }
    });
    await this.stopListening();
    await this.startListening();
  }
  isRunning() {
    return this.keyboardProcess !== null;
  }
  dispose() {
    this.stopListening();
    this.mainWindow = null;
  }
}
class TrayFeature {
  constructor(mainWindow2, keyboardService2) {
    __publicField(this, "tray", null);
    __publicField(this, "mainWindow", null);
    __publicField(this, "keyboardService", null);
    this.mainWindow = mainWindow2;
    this.keyboardService = keyboardService2;
  }
  async initialize() {
    const icon = electron.nativeImage.createFromPath(path.join(__dirname, "../../src/assets/tray-icon.png")).resize({ width: 16, height: 16 });
    this.tray = new electron.Tray(icon);
    this.tray.setToolTip("HyperCaps - Keyboard Remapping Tool");
    await this.setupTrayMenu();
    this.registerGlobalShortcuts();
    this.setupEventListeners();
  }
  async setupTrayMenu() {
    if (!this.tray) return;
    const store = Store.getInstance();
    const isEnabled = (await store.getFeature("hyperKey")).isFeatureEnabled;
    const { startupOnBoot, enableOnStartup } = store.getState();
    const contextMenu = electron.Menu.buildFromTemplate([
      {
        label: "HyperCaps",
        enabled: false,
        icon: electron.nativeImage.createFromPath(
          path.join(__dirname, "../../src/assets/tray-icon.png")
        ).resize({ width: 16, height: 16 })
      },
      { type: "separator" },
      {
        label: "Enable HyperCaps",
        type: "checkbox",
        checked: isEnabled,
        accelerator: "CommandOrControl+Shift+E",
        click: async (menuItem) => {
          var _a, _b, _c, _d, _e, _f;
          console.log("[Tray] Toggle HyperCaps:", menuItem.checked);
          const prevState = (_a = this.keyboardService) == null ? void 0 : _a.getState();
          console.log("[Tray] Previous state:", prevState);
          try {
            if (menuItem.checked) {
              await ((_b = this.keyboardService) == null ? void 0 : _b.startListening());
            } else {
              await ((_c = this.keyboardService) == null ? void 0 : _c.stopListening());
            }
            const newState = (_d = this.keyboardService) == null ? void 0 : _d.getState();
            console.log("[Tray] New state:", newState);
            await store.update((draft) => {
              const feature = draft.features.find((f) => f.name === "hyperKey");
              if (feature) {
                feature.isFeatureEnabled = menuItem.checked;
              }
            });
            const finalState = (_e = this.keyboardService) == null ? void 0 : _e.getState();
            console.log("[Tray] Final state check:", {
              menuChecked: menuItem.checked,
              serviceState: finalState,
              processRunning: (_f = this.keyboardService) == null ? void 0 : _f.isRunning()
            });
          } catch (error) {
            console.error("[Tray] Error toggling service:", error);
            menuItem.checked = !menuItem.checked;
            electron.dialog.showErrorBox(
              "HyperCaps Error",
              `Failed to ${menuItem.checked ? "enable" : "disable"} HyperCaps: ${error.message}`
            );
          }
        }
      },
      { type: "separator" },
      {
        label: "Start with Windows",
        type: "checkbox",
        checked: startupOnBoot,
        click: async (menuItem) => {
          await store.setStartupOnBoot(menuItem.checked);
        }
      },
      {
        label: "Enable on Startup",
        type: "checkbox",
        checked: enableOnStartup,
        click: async (menuItem) => {
          await store.update((draft) => {
            const hyperkeyFeature = draft.features.find(
              (f) => f.name == "hyperKey"
            );
            if (hyperkeyFeature) {
              hyperkeyFeature.isFeatureEnabled = menuItem.checked;
            }
          });
        }
      },
      { type: "separator" },
      {
        label: "Open Shortcut Manager",
        accelerator: "CommandOrControl+Shift+S",
        click: () => {
          this.showWindow();
        }
      },
      { type: "separator" },
      {
        label: "About HyperCaps",
        click: () => {
          electron.dialog.showMessageBox({
            type: "info",
            title: "About HyperCaps",
            message: "HyperCaps - Advanced Keyboard Remapping Tool",
            detail: "Version 0.0.1\nCreated for Windows power users."
          });
        }
      },
      { type: "separator" },
      {
        label: "Quit HyperCaps",
        accelerator: "CommandOrControl+Q",
        click: () => {
          this.quit();
        }
      }
    ]);
    this.tray.setContextMenu(contextMenu);
  }
  registerGlobalShortcuts() {
    const ret = electron.globalShortcut.register("CommandOrControl+Shift+S", () => {
      this.showWindow();
    });
    if (!ret) {
      console.error("Failed to register global shortcut");
    }
  }
  setupEventListeners() {
    if (!this.tray) return;
    this.tray.on("double-click", () => {
      this.showWindow();
    });
  }
  showWindow() {
    var _a, _b;
    (_a = this.mainWindow) == null ? void 0 : _a.show();
    (_b = this.mainWindow) == null ? void 0 : _b.focus();
  }
  quit() {
    if (this.mainWindow) {
      this.mainWindow.isQuitting = true;
    }
    require("electron").app.quit();
  }
  dispose() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
console.log("=== Environment Debug ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("isDev:", process.env.NODE_ENV === "development");
console.log("======================");
if (process.platform !== "win32") {
  electron.dialog.showErrorBox(
    "Unsupported Platform",
    "HyperCaps is only supported on Windows. The application will now exit."
  );
  electron.app.quit();
}
if (require("electron-squirrel-startup")) {
  electron.app.quit();
}
let keyboardService;
let trayFeature = null;
let mainWindow = null;
const createWindow = async () => {
  console.log("Environment:", process.env.NODE_ENV);
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload/preload.js")
    },
    resizable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    // Round corners on Windows 11
    roundedCorners: true,
    backgroundMaterial: "acrylic",
    darkTheme: true,
    backgroundColor: "#00000000"
  });
  electron.ipcMain.on("start-listening", () => {
    keyboardService == null ? void 0 : keyboardService.startListening();
  });
  electron.ipcMain.on("stop-listening", () => {
    keyboardService == null ? void 0 : keyboardService.stopListening();
  });
  electron.ipcMain.handle("get-keyboard-service-state", () => {
    return (keyboardService == null ? void 0 : keyboardService.isRunning()) || false;
  });
  electron.ipcMain.handle("get-hyperkey-config", async () => {
    try {
      const store = Store.getInstance();
      const feature = await store.getFeature("hyperKey");
      if (!feature) {
        throw new Error("HyperKey feature not found");
      }
      return feature.config;
    } catch (err) {
      console.error("Failed to get HyperKey config:", err);
      throw err;
    }
  });
  electron.ipcMain.handle("set-hyperkey-config", async (event, config) => {
    const store = Store.getInstance();
    await store.update((draft) => {
      const hyperkeyFeature = draft.features.find((f) => f.name == "hyperKey");
      if (hyperkeyFeature) {
        hyperkeyFeature.config = config;
      }
    });
    await (keyboardService == null ? void 0 : keyboardService.restartWithConfig(config));
  });
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("close", (event) => {
    if (!mainWindow.isQuitting) {
      event.preventDefault();
      mainWindow == null ? void 0 : mainWindow.hide();
      return false;
    }
  });
};
electron.ipcMain.on("minimize-window", () => {
  mainWindow == null ? void 0 : mainWindow.minimize();
});
electron.ipcMain.on("close-window", () => {
  mainWindow == null ? void 0 : mainWindow.hide();
});
electron.app.whenReady().then(async () => {
  const store = Store.getInstance();
  await store.load();
  keyboardService = new KeyboardService();
  await keyboardService.init();
  await createWindow();
  if (mainWindow) {
    keyboardService.setMainWindow(mainWindow);
  }
  if (mainWindow && keyboardService) {
    trayFeature = new TrayFeature(mainWindow, keyboardService);
    await trayFeature.initialize();
  }
  electron.ipcMain.handle("get-startup-settings", async () => {
    const { enableOnStartup, startupOnBoot } = store.getState();
    return { startupOnBoot, enableOnStartup };
  });
  electron.ipcMain.handle("set-startup-on-boot", async (_, enabled) => {
    await store.setStartupOnBoot(enabled);
  });
  electron.ipcMain.handle("set-enable-on-startup", async (_, enabled) => {
    await store.setStartupOnBoot(enabled);
  });
  electron.ipcMain.handle("get-full-state", async () => {
    return keyboardService.getState();
  });
  electron.ipcMain.on("minimize-window", () => {
    mainWindow == null ? void 0 : mainWindow.minimize();
  });
});
electron.app.on("before-quit", () => {
  if (keyboardService) {
    keyboardService.dispose();
  }
  if (trayFeature) {
    trayFeature.dispose();
  }
  electron.globalShortcut.unregisterAll();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//# sourceMappingURL=main.js.map
