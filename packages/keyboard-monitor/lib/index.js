"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyboardMonitor = void 0;
const bindings_1 = __importDefault(require("bindings"));
const addon = (0, bindings_1.default)('keyboard_monitor');
class KeyboardMonitor {
    constructor(callback) {
        this.monitor = new addon.KeyboardMonitor(callback);
    }
    start() {
        this.monitor.start();
    }
    stop() {
        this.monitor.stop();
    }
    setConfig(config) {
        this.monitor.setConfig(config);
    }
}
exports.KeyboardMonitor = KeyboardMonitor;
