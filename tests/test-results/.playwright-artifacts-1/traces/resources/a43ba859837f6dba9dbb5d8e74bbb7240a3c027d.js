"use strict";
(globalThis["webpackChunkfrontend"] = globalThis["webpackChunkfrontend"] || []).push([["src_pages_Mining_js-node_modules_radix-ui_react-slot_dist_index_mjs"],{

/***/ "./node_modules/@radix-ui/react-compose-refs/dist/index.mjs":
/*!******************************************************************!*\
  !*** ./node_modules/@radix-ui/react-compose-refs/dist/index.mjs ***!
  \******************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   composeRefs: () => (/* binding */ composeRefs),
/* harmony export */   useComposedRefs: () => (/* binding */ useComposedRefs)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
// packages/react/compose-refs/src/compose-refs.tsx

function setRef(ref, value) {
  if (typeof ref === "function") {
    return ref(value);
  } else if (ref !== null && ref !== void 0) {
    ref.current = value;
  }
}
function composeRefs(...refs) {
  return node => {
    let hasCleanup = false;
    const cleanups = refs.map(ref => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup == "function") {
        hasCleanup = true;
      }
      return cleanup;
    });
    if (hasCleanup) {
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup == "function") {
            cleanup();
          } else {
            setRef(refs[i], null);
          }
        }
      };
    }
  };
}
function useComposedRefs(...refs) {
  return react__WEBPACK_IMPORTED_MODULE_0__.useCallback(composeRefs(...refs), refs);
}


/***/ }),

/***/ "./node_modules/@radix-ui/react-slot/dist/index.mjs":
/*!**********************************************************!*\
  !*** ./node_modules/@radix-ui/react-slot/dist/index.mjs ***!
  \**********************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Root: () => (/* binding */ Slot),
/* harmony export */   Slot: () => (/* binding */ Slot),
/* harmony export */   Slottable: () => (/* binding */ Slottable),
/* harmony export */   createSlot: () => (/* binding */ createSlot),
/* harmony export */   createSlottable: () => (/* binding */ createSlottable)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var _radix_ui_react_compose_refs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @radix-ui/react-compose-refs */ "./node_modules/@radix-ui/react-compose-refs/dist/index.mjs");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-runtime */ "./node_modules/react/jsx-runtime.js");
// src/slot.tsx



// @__NO_SIDE_EFFECTS__
function createSlot(ownerName) {
  const SlotClone = /* @__PURE__ */createSlotClone(ownerName);
  const Slot2 = react__WEBPACK_IMPORTED_MODULE_0__.forwardRef((props, forwardedRef) => {
    const {
      children,
      ...slotProps
    } = props;
    const childrenArray = react__WEBPACK_IMPORTED_MODULE_0__.Children.toArray(children);
    const slottable = childrenArray.find(isSlottable);
    if (slottable) {
      const newElement = slottable.props.children;
      const newChildren = childrenArray.map(child => {
        if (child === slottable) {
          if (react__WEBPACK_IMPORTED_MODULE_0__.Children.count(newElement) > 1) return react__WEBPACK_IMPORTED_MODULE_0__.Children.only(null);
          return react__WEBPACK_IMPORTED_MODULE_0__.isValidElement(newElement) ? newElement.props.children : null;
        } else {
          return child;
        }
      });
      return /* @__PURE__ */(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(SlotClone, {
        ...slotProps,
        ref: forwardedRef,
        children: react__WEBPACK_IMPORTED_MODULE_0__.isValidElement(newElement) ? react__WEBPACK_IMPORTED_MODULE_0__.cloneElement(newElement, void 0, newChildren) : null
      });
    }
    return /* @__PURE__ */(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(SlotClone, {
      ...slotProps,
      ref: forwardedRef,
      children
    });
  });
  Slot2.displayName = `${ownerName}.Slot`;
  return Slot2;
}
var Slot = /* @__PURE__ */createSlot("Slot");
// @__NO_SIDE_EFFECTS__
function createSlotClone(ownerName) {
  const SlotClone = react__WEBPACK_IMPORTED_MODULE_0__.forwardRef((props, forwardedRef) => {
    const {
      children,
      ...slotProps
    } = props;
    if (react__WEBPACK_IMPORTED_MODULE_0__.isValidElement(children)) {
      const childrenRef = getElementRef(children);
      const props2 = mergeProps(slotProps, children.props);
      if (children.type !== react__WEBPACK_IMPORTED_MODULE_0__.Fragment) {
        props2.ref = forwardedRef ? (0,_radix_ui_react_compose_refs__WEBPACK_IMPORTED_MODULE_1__.composeRefs)(forwardedRef, childrenRef) : childrenRef;
      }
      return react__WEBPACK_IMPORTED_MODULE_0__.cloneElement(children, props2);
    }
    return react__WEBPACK_IMPORTED_MODULE_0__.Children.count(children) > 1 ? react__WEBPACK_IMPORTED_MODULE_0__.Children.only(null) : null;
  });
  SlotClone.displayName = `${ownerName}.SlotClone`;
  return SlotClone;
}
var SLOTTABLE_IDENTIFIER = Symbol("radix.slottable");
// @__NO_SIDE_EFFECTS__
function createSlottable(ownerName) {
  const Slottable2 = ({
    children
  }) => {
    return /* @__PURE__ */(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.Fragment, {
      children
    });
  };
  Slottable2.displayName = `${ownerName}.Slottable`;
  Slottable2.__radixId = SLOTTABLE_IDENTIFIER;
  return Slottable2;
}
var Slottable = /* @__PURE__ */createSlottable("Slottable");
function isSlottable(child) {
  return react__WEBPACK_IMPORTED_MODULE_0__.isValidElement(child) && typeof child.type === "function" && "__radixId" in child.type && child.type.__radixId === SLOTTABLE_IDENTIFIER;
}
function mergeProps(slotProps, childProps) {
  const overrideProps = {
    ...childProps
  };
  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args) => {
          const result = childPropValue(...args);
          slotPropValue(...args);
          return result;
        };
      } else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    } else if (propName === "style") {
      overrideProps[propName] = {
        ...slotPropValue,
        ...childPropValue
      };
    } else if (propName === "className") {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
    }
  }
  return {
    ...slotProps,
    ...overrideProps
  };
}
function getElementRef(element) {
  let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.ref;
  }
  getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }
  return element.props.ref || element.ref;
}


/***/ }),

/***/ "./node_modules/lucide-react/dist/esm/icons/arrow-left.js":
/*!****************************************************************!*\
  !*** ./node_modules/lucide-react/dist/esm/icons/arrow-left.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   __iconNode: () => (/* binding */ __iconNode),
/* harmony export */   "default": () => (/* binding */ ArrowLeft)
/* harmony export */ });
/* harmony import */ var _createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../createLucideIcon.js */ "./node_modules/lucide-react/dist/esm/createLucideIcon.js");
/**
 * @license lucide-react v0.507.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */


const __iconNode = [["path", {
  d: "m12 19-7-7 7-7",
  key: "1l729n"
}], ["path", {
  d: "M19 12H5",
  key: "x3x0zl"
}]];
const ArrowLeft = (0,_createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__["default"])("arrow-left", __iconNode);


/***/ }),

/***/ "./node_modules/lucide-react/dist/esm/icons/clock.js":
/*!***********************************************************!*\
  !*** ./node_modules/lucide-react/dist/esm/icons/clock.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   __iconNode: () => (/* binding */ __iconNode),
/* harmony export */   "default": () => (/* binding */ Clock)
/* harmony export */ });
/* harmony import */ var _createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../createLucideIcon.js */ "./node_modules/lucide-react/dist/esm/createLucideIcon.js");
/**
 * @license lucide-react v0.507.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */


const __iconNode = [["circle", {
  cx: "12",
  cy: "12",
  r: "10",
  key: "1mglay"
}], ["polyline", {
  points: "12 6 12 12 16 14",
  key: "68esgv"
}]];
const Clock = (0,_createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__["default"])("clock", __iconNode);


/***/ }),

/***/ "./node_modules/lucide-react/dist/esm/icons/coins.js":
/*!***********************************************************!*\
  !*** ./node_modules/lucide-react/dist/esm/icons/coins.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   __iconNode: () => (/* binding */ __iconNode),
/* harmony export */   "default": () => (/* binding */ Coins)
/* harmony export */ });
/* harmony import */ var _createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../createLucideIcon.js */ "./node_modules/lucide-react/dist/esm/createLucideIcon.js");
/**
 * @license lucide-react v0.507.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */


const __iconNode = [["circle", {
  cx: "8",
  cy: "8",
  r: "6",
  key: "3yglwk"
}], ["path", {
  d: "M18.09 10.37A6 6 0 1 1 10.34 18",
  key: "t5s6rm"
}], ["path", {
  d: "M7 6h1v4",
  key: "1obek4"
}], ["path", {
  d: "m16.71 13.88.7.71-2.82 2.82",
  key: "1rbuyh"
}]];
const Coins = (0,_createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__["default"])("coins", __iconNode);


/***/ }),

/***/ "./node_modules/lucide-react/dist/esm/icons/play.js":
/*!**********************************************************!*\
  !*** ./node_modules/lucide-react/dist/esm/icons/play.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   __iconNode: () => (/* binding */ __iconNode),
/* harmony export */   "default": () => (/* binding */ Play)
/* harmony export */ });
/* harmony import */ var _createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../createLucideIcon.js */ "./node_modules/lucide-react/dist/esm/createLucideIcon.js");
/**
 * @license lucide-react v0.507.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */


const __iconNode = [["polygon", {
  points: "6 3 20 12 6 21 6 3",
  key: "1oa8hb"
}]];
const Play = (0,_createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__["default"])("play", __iconNode);


/***/ }),

/***/ "./node_modules/lucide-react/dist/esm/icons/star.js":
/*!**********************************************************!*\
  !*** ./node_modules/lucide-react/dist/esm/icons/star.js ***!
  \**********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   __iconNode: () => (/* binding */ __iconNode),
/* harmony export */   "default": () => (/* binding */ Star)
/* harmony export */ });
/* harmony import */ var _createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../createLucideIcon.js */ "./node_modules/lucide-react/dist/esm/createLucideIcon.js");
/**
 * @license lucide-react v0.507.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */


const __iconNode = [["path", {
  d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
  key: "r04s7s"
}]];
const Star = (0,_createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__["default"])("star", __iconNode);


/***/ }),

/***/ "./node_modules/lucide-react/dist/esm/icons/trending-up.js":
/*!*****************************************************************!*\
  !*** ./node_modules/lucide-react/dist/esm/icons/trending-up.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   __iconNode: () => (/* binding */ __iconNode),
/* harmony export */   "default": () => (/* binding */ TrendingUp)
/* harmony export */ });
/* harmony import */ var _createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../createLucideIcon.js */ "./node_modules/lucide-react/dist/esm/createLucideIcon.js");
/**
 * @license lucide-react v0.507.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */


const __iconNode = [["polyline", {
  points: "22 7 13.5 15.5 8.5 10.5 2 17",
  key: "126l90"
}], ["polyline", {
  points: "16 7 22 7 22 13",
  key: "kwv8wd"
}]];
const TrendingUp = (0,_createLucideIcon_js__WEBPACK_IMPORTED_MODULE_0__["default"])("trending-up", __iconNode);


/***/ }),

/***/ "./src/pages/Mining.js":
/*!*****************************!*\
  !*** ./src/pages/Mining.js ***!
  \*****************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var axios__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! axios */ "./node_modules/axios/lib/axios.js");
/* harmony import */ var _components_ui_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/components/ui/button */ "./src/components/ui/button.jsx");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/circle-check-big.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/arrow-left.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/clock.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/coins.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/crown.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/gift.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/info.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/play.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/star.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/trending-up.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/zap.js");
/* harmony import */ var sonner__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! sonner */ "./node_modules/sonner/dist/index.mjs");
/* harmony import */ var _utils_smartToast__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @/utils/smartToast */ "./src/utils/smartToast.js");
/* harmony import */ var react_router_dom__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! react-router-dom */ "./node_modules/react-router/dist/development/chunk-OIYGIGL5.mjs");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! framer-motion */ "./node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! framer-motion */ "./node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs");
/* harmony import */ var _contexts_LanguageContext__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @/contexts/LanguageContext */ "./src/contexts/LanguageContext.js");
/* harmony import */ var _components_InfoTooltip__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @/components/InfoTooltip */ "./src/components/InfoTooltip.jsx");
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/pages/Mining.js",
  _s = __webpack_require__.$Refresh$.signature(),
  _s2 = __webpack_require__.$Refresh$.signature();










// PRCBurnAlert removed - free users no longer collect PRC

const API = `${"https://razorpay-auto-sync.preview.emergentagent.com"}/api`;

// Animated counter component for live PRC display - ALWAYS shows positive values
const AnimatedCounter = ({
  value,
  decimals = 4
}) => {
  _s();
  const [displayValue, setDisplayValue] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(Math.max(0, value));
  const prevValueRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(Math.max(0, value));
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    // Ensure value is always positive
    const safeValue = Math.max(0, value);
    const prevValue = prevValueRef.current;
    const diff = safeValue - prevValue;

    // If new value is less than previous (e.g., after collect), just set it directly without animation
    if (safeValue < prevValue || Math.abs(diff) < 0.0001) {
      setDisplayValue(safeValue);
      prevValueRef.current = safeValue;
      return;
    }

    // Smooth animation over 100ms for increasing values only
    const steps = 10;
    const stepValue = diff / steps;
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(safeValue);
        prevValueRef.current = safeValue;
        clearInterval(interval);
      } else {
        setDisplayValue(prev => Math.max(0, prev + stepValue));
      }
    }, 10);
    return () => clearInterval(interval);
  }, [value]);
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
    className: "tabular-nums",
    children: Math.max(0, displayValue).toFixed(decimals)
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 53,
    columnNumber: 5
  }, undefined);
};

// Floating coin animation for visual feedback
_s(AnimatedCounter, "qlhfO03F0RlXONdH/0t6APWhAFA=");
_c = AnimatedCounter;
const FloatingCoin = ({
  onComplete
}) => {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
    initial: {
      opacity: 1,
      y: 0,
      scale: 1
    },
    animate: {
      opacity: 0,
      y: -30,
      scale: 0.5
    },
    transition: {
      duration: 0.8,
      ease: "easeOut"
    },
    onAnimationComplete: onComplete,
    className: "absolute text-amber-400 text-sm font-bold",
    children: "+PRC"
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 62,
    columnNumber: 5
  }, undefined);
};

// Sparkle particle effect for extra visual appeal
_c2 = FloatingCoin;
const SparkleParticle = ({
  delay = 0,
  x = 0
}) => {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
    className: "absolute w-1 h-1 bg-amber-400 rounded-full",
    initial: {
      opacity: 0,
      scale: 0,
      x: x,
      y: 0
    },
    animate: {
      opacity: [0, 1, 0],
      scale: [0, 1.5, 0],
      y: [-10, -30],
      x: [x, x + (Math.random() - 0.5) * 20]
    },
    transition: {
      duration: 1.2,
      delay: delay,
      ease: "easeOut"
    }
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 77,
    columnNumber: 5
  }, undefined);
};

// Pulse ring animation around the counter
_c3 = SparkleParticle;
const PulseRing = () => {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
    className: "absolute inset-0 rounded-2xl border-2 border-amber-500/30",
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.3, 0.6, 0.3]
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 98,
    columnNumber: 5
  }, undefined);
};

// Number flip animation component
_c4 = PulseRing;
const FlipDigit = ({
  digit,
  prevDigit
}) => {
  const hasChanged = digit !== prevDigit;
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.span, {
    initial: hasChanged ? {
      rotateX: -90,
      opacity: 0
    } : false,
    animate: {
      rotateX: 0,
      opacity: 1
    },
    transition: {
      duration: 0.3,
      ease: "easeOut"
    },
    className: "inline-block",
    style: {
      transformStyle: 'preserve-3d'
    },
    children: digit
  }, digit, false, {
    fileName: _jsxFileName,
    lineNumber: 118,
    columnNumber: 5
  }, undefined);
};

// Rainbow Gradient Border Animation
_c5 = FlipDigit;
const RainbowBorder = () => {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
    className: "absolute -inset-1 rounded-3xl opacity-60 blur-sm",
    style: {
      background: 'linear-gradient(90deg, #10b981, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #f59e0b, #10b981)',
      backgroundSize: '400% 100%'
    },
    animate: {
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
    },
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "linear"
    }
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 134,
    columnNumber: 5
  }, undefined);
};

// Orbiting Coin Animation
_c6 = RainbowBorder;
const OrbitingCoin = ({
  delay = 0,
  radius = 60,
  duration = 4
}) => {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
    className: "absolute",
    style: {
      width: 20,
      height: 20,
      left: '50%',
      top: '50%',
      marginLeft: -10,
      marginTop: -10
    },
    animate: {
      rotate: 360
    },
    transition: {
      duration: duration,
      repeat: Infinity,
      ease: "linear",
      delay: delay
    },
    children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
      className: "absolute bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full shadow-lg flex items-center justify-center text-xs font-bold text-amber-900",
      style: {
        width: 20,
        height: 20,
        transform: `translateX(${radius}px)`
      },
      animate: {
        scale: [1, 1.2, 1],
        boxShadow: ['0 0 5px rgba(251, 191, 36, 0.5)', '0 0 15px rgba(251, 191, 36, 0.8)', '0 0 5px rgba(251, 191, 36, 0.5)']
      },
      transition: {
        duration: 1.5,
        repeat: Infinity
      },
      children: "\u20B9"
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 175,
      columnNumber: 7
    }, undefined)
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 155,
    columnNumber: 5
  }, undefined);
};

// Confetti Particle for burst effect
_c7 = OrbitingCoin;
const ConfettiParticle = ({
  index,
  onComplete
}) => {
  const colors = ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
  const color = colors[index % colors.length];
  const angle = index * 360 / 12;
  const distance = 80 + Math.random() * 40;
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
    className: "absolute w-3 h-3 rounded-full",
    style: {
      backgroundColor: color,
      left: '50%',
      top: '50%',
      marginLeft: -6,
      marginTop: -6
    },
    initial: {
      scale: 0,
      x: 0,
      y: 0
    },
    animate: {
      scale: [0, 1, 0],
      x: Math.cos(angle * Math.PI / 180) * distance,
      y: Math.sin(angle * Math.PI / 180) * distance,
      rotate: 360
    },
    transition: {
      duration: 0.8,
      ease: "easeOut"
    },
    onAnimationComplete: index === 0 ? onComplete : undefined
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 209,
    columnNumber: 5
  }, undefined);
};

// Aurora Background Effect
_c8 = ConfettiParticle;
const AuroraBackground = () => {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
    className: "absolute inset-0 overflow-hidden rounded-3xl",
    children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
      className: "absolute w-[200%] h-[200%] -top-1/2 -left-1/2",
      style: {
        background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 30% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(251, 191, 36, 0.15) 0%, transparent 50%)'
      },
      animate: {
        rotate: [0, 360]
      },
      transition: {
        duration: 30,
        repeat: Infinity,
        ease: "linear"
      }
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 238,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
      className: "absolute w-full h-full",
      style: {
        background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%)'
      },
      animate: {
        x: ['-100%', '100%']
      },
      transition: {
        duration: 5,
        repeat: Infinity,
        ease: "linear"
      }
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 252,
      columnNumber: 7
    }, undefined)]
  }, void 0, true, {
    fileName: _jsxFileName,
    lineNumber: 237,
    columnNumber: 5
  }, undefined);
};

// Floating Bubble Animation
_c9 = AuroraBackground;
const FloatingBubble = ({
  delay = 0,
  size = 30,
  left = '50%'
}) => {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
    className: "absolute rounded-full bg-gradient-to-br from-white/40 to-emerald-200/30 backdrop-blur-sm border border-white/30",
    style: {
      width: size,
      height: size,
      left: left,
      bottom: -size
    },
    animate: {
      y: [0, -400],
      x: [0, (Math.random() - 0.5) * 50],
      opacity: [0, 0.8, 0],
      scale: [0.5, 1, 0.8]
    },
    transition: {
      duration: 4 + Math.random() * 2,
      repeat: Infinity,
      delay: delay,
      ease: "easeOut"
    }
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 273,
    columnNumber: 5
  }, undefined);
};

// Glowing Shadow Effect
_c0 = FloatingBubble;
const GlowingShadow = () => {
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
    className: "absolute inset-0 rounded-2xl",
    animate: {
      boxShadow: ['0 0 15px rgba(16, 185, 129, 0.2), 0 0 30px rgba(16, 185, 129, 0.15)', '0 0 30px rgba(16, 185, 129, 0.35), 0 0 60px rgba(16, 185, 129, 0.2)', '0 0 15px rgba(16, 185, 129, 0.2), 0 0 30px rgba(16, 185, 129, 0.15)']
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 300,
    columnNumber: 5
  }, undefined);
};
_c1 = GlowingShadow;
const DailyRewards = ({
  user
}) => {
  _s2();
  var _referralBreakdown$le, _referralBreakdown$le2, _referralBreakdown$le3, _referralBreakdown$le4, _referralBreakdown$le5, _referralBreakdown$le6, _referralBreakdown$le7, _referralBreakdown$le8, _referralBreakdown$le9, _referralBreakdown$le0, _referralBreakdown$le1, _referralBreakdown$le10, _referralBreakdown$le11, _referralBreakdown$le12, _referralBreakdown$le13, _referralBreakdown$le14, _referralBreakdown$le15, _referralBreakdown$le16, _referralBreakdown$le17, _referralBreakdown$le18, _referralBreakdown$le19, _referralBreakdown$le20, _referralBreakdown$le21, _referralBreakdown$le22, _referralBreakdown$le23, _referralBreakdown$le24, _referralBreakdown$le25, _referralBreakdown$le26, _referralBreakdown$le27, _referralBreakdown$le28;
  const navigate = (0,react_router_dom__WEBPACK_IMPORTED_MODULE_16__.useNavigate)();
  const {
    language
  } = (0,_contexts_LanguageContext__WEBPACK_IMPORTED_MODULE_19__.useLanguage)();
  const [loading, setLoading] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
  const [userData, setUserData] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [isMining, setIsMining] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [sessionTimeRemaining, setSessionTimeRemaining] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const [sessionPRC, setSessionPRC] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const [miningRate, setMiningRate] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(1.0);
  const [isStarting, setIsStarting] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [isCollecting, setIsCollecting] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [sessionStartTime, setSessionStartTime] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const [lifetimeEarnings, setLifetimeEarnings] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const [showFloatingCoin, setShowFloatingCoin] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [showConfetti, setShowConfetti] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [sessionProgress, setSessionProgress] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0); // Real progress percentage
  const [referralBreakdown, setReferralBreakdown] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null); // Level-wise breakdown
  const [baseRate, setBaseRate] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0); // Individual base mining rate

  const timerRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const liveCounterRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const progressRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);

  // Get global translation function
  const {
    t: globalT
  } = (0,_contexts_LanguageContext__WEBPACK_IMPORTED_MODULE_19__.useLanguage)();

  // Check if user is free user (explorer, free, or no plan)
  const subscriptionPlan = (userData === null || userData === void 0 ? void 0 : userData.subscription_plan) || 'explorer';
  const isFreeUser = !subscriptionPlan || subscriptionPlan === 'explorer' || subscriptionPlan === 'free' || subscriptionPlan === '';

  // Fetch user data and mining status
  const fetchUserData = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    // Set a timeout to prevent infinite loading on slow networks
    // OPTIMIZED: Reduced timeout from 10s to 5s for faster failure
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setUserData(user);
      console.warn('Mining data fetch timeout - using fallback');
    }, 5000); // 5 second timeout

    try {
      // Fetch user data, mining status, and redemption stats in parallel
      const [userResponse, miningResponse, statsResponse] = await Promise.all([axios__WEBPACK_IMPORTED_MODULE_1__["default"].get(`${API}/user/${user.uid}`), axios__WEBPACK_IMPORTED_MODULE_1__["default"].get(`${API}/mining/status/${user.uid}`), axios__WEBPACK_IMPORTED_MODULE_1__["default"].get(`${API}/user/${user.uid}/redemption-stats`)]);
      const data = userResponse.data;
      const miningData = miningResponse.data;
      const statsData = statsResponse.data;
      setUserData(data);
      // Use the actual mining rate from backend (per hour)
      setMiningRate(miningData.mining_rate_per_hour || miningData.mining_rate || 1.0);
      // Set lifetime earnings from redemption stats API for consistency
      setLifetimeEarnings(statsData.total_earned || 0);
      // Set referral breakdown from backend
      setReferralBreakdown(miningData.referral_breakdown || null);
      // Set base rate (individual mining)
      setBaseRate(miningData.base_rate || 0);

      // Check mining session status
      if (miningData.session_active && miningData.remaining_hours > 0) {
        setIsMining(true);
        setSessionTimeRemaining(Math.floor(miningData.remaining_hours * 3600));
        const sessionStart = new Date(miningData.session_start).getTime();
        setSessionStartTime(sessionStart);

        // Calculate initial progress
        const totalDuration = 24 * 60 * 60 * 1000; // 24 hours
        const elapsed = Date.now() - sessionStart;
        setSessionProgress(Math.min(100, elapsed / totalDuration * 100));

        // Use mined_this_session from backend
        setSessionPRC(miningData.mined_this_session || 0);
      } else if (data.mining_active && data.mining_session_end) {
        const endTime = new Date(data.mining_session_end).getTime();
        const startTime = data.mining_start_time ? new Date(data.mining_start_time).getTime() : endTime - 24 * 60 * 60 * 1000;
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        if (remaining > 0) {
          setIsMining(true);
          setSessionTimeRemaining(remaining);
          setSessionStartTime(startTime);

          // Calculate initial progress
          const totalDuration = 24 * 60 * 60 * 1000;
          const elapsed = now - startTime;
          setSessionProgress(Math.min(100, elapsed / totalDuration * 100));
          setSessionPRC(miningData.mined_this_session || 0);
        } else {
          setIsMining(false);
          setSessionTimeRemaining(0);
          setSessionProgress(0);
        }
      } else {
        setIsMining(false);
        setSessionTimeRemaining(0);
        setSessionProgress(0);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(user);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [user]);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (user !== null && user !== void 0 && user.uid) {
      fetchUserData();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (liveCounterRef.current) {
        clearInterval(liveCounterRef.current);
      }
    };
  }, [user, fetchUserData]);

  // Timer effect - separate from data fetch
  // OPTIMIZED: Main timer every 5s, live counter every 100ms for smooth animation
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (liveCounterRef.current) {
      clearInterval(liveCounterRef.current);
    }
    if (progressRef.current) {
      clearInterval(progressRef.current);
    }
    if (isMining && sessionTimeRemaining > 0) {
      // Main timer updates every 5 seconds for time display
      timerRef.current = setInterval(() => {
        setSessionTimeRemaining(prev => {
          if (prev <= 5) {
            setIsMining(false);
            setSessionProgress(100);
            _utils_smartToast__WEBPACK_IMPORTED_MODULE_15__["default"].success('Session complete! Collect your rewards.');
            clearInterval(timerRef.current);
            if (liveCounterRef.current) clearInterval(liveCounterRef.current);
            if (progressRef.current) clearInterval(progressRef.current);
            return 0;
          }
          return prev - 5;
        });

        // Show floating coin animation periodically
        setShowFloatingCoin(true);
        setTimeout(() => setShowFloatingCoin(false), 800);
      }, 5000);

      // Live counter updates every 100ms for smooth real-time feel
      liveCounterRef.current = setInterval(() => {
        const prcPer100ms = miningRate / 36000; // Per 100ms
        setSessionPRC(prev => Math.max(0, prev + prcPer100ms));
      }, 100);

      // Progress bar updates every second for smooth progression
      progressRef.current = setInterval(() => {
        if (sessionStartTime) {
          const totalDuration = 24 * 60 * 60 * 1000; // 24 hours in ms
          const elapsed = Date.now() - sessionStartTime;
          const progress = Math.min(100, elapsed / totalDuration * 100);
          setSessionProgress(progress);
        }
      }, 1000);

      // Calculate initial progress
      if (sessionStartTime) {
        const totalDuration = 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - sessionStartTime;
        setSessionProgress(Math.min(100, elapsed / totalDuration * 100));
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (liveCounterRef.current) {
        clearInterval(liveCounterRef.current);
      }
      if (progressRef.current) {
        clearInterval(progressRef.current);
      }
    };
  }, [isMining, miningRate, sessionStartTime]);
  const startSession = async () => {
    setIsStarting(true);
    try {
      const response = await axios__WEBPACK_IMPORTED_MODULE_1__["default"].post(`${API}/mining/start/${user.uid}`);
      if (response.data) {
        setIsMining(true);
        setSessionTimeRemaining(24 * 60 * 60); // 24 hours
        setSessionPRC(0);
        setSessionStartTime(Date.now());
        setSessionProgress(0); // Reset progress to 0
        _utils_smartToast__WEBPACK_IMPORTED_MODULE_15__["default"].success('Session started! Earning PRC...');

        // Refresh user data
        setTimeout(() => fetchUserData(), 500);
      }
    } catch (error) {
      var _error$response, _error$response$data;
      const detail = ((_error$response = error.response) === null || _error$response === void 0 ? void 0 : (_error$response$data = _error$response.data) === null || _error$response$data === void 0 ? void 0 : _error$response$data.detail) || 'Failed to start session';
      if (detail.includes('already active')) {
        _utils_smartToast__WEBPACK_IMPORTED_MODULE_15__["default"].info('Session already active!');
        fetchUserData();
      } else {
        _utils_smartToast__WEBPACK_IMPORTED_MODULE_15__["default"].error(detail);
      }
    } finally {
      setIsStarting(false);
    }
  };
  const collectRewards = async () => {
    if (sessionPRC < 0.01) {
      _utils_smartToast__WEBPACK_IMPORTED_MODULE_15__["default"].error('Not enough PRC to collect');
      return;
    }
    setIsCollecting(true);
    try {
      // Claim mining rewards - uses correct endpoint with 80/20 luxury split
      const response = await axios__WEBPACK_IMPORTED_MODULE_1__["default"].post(`${API}/mining/claim/${user.uid}`);
      const data = response.data;
      const claimed = data.claimed_amount || data.prc_collected || sessionPRC;

      // Trigger confetti celebration!
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1000);
      _utils_smartToast__WEBPACK_IMPORTED_MODULE_15__["default"].success(`🎉 Collected ${claimed.toFixed(2)} PRC!`, {
        position: 'top-center'
      });

      // IMPORTANT: Immediately reset sessionPRC to 0 to avoid negative display
      setSessionPRC(0);

      // Reset session using response data - this ensures immediate UI update
      if (data.session_reset) {
        const newStartTime = new Date(data.new_session_start).getTime();
        setSessionStartTime(newStartTime);
        setSessionTimeRemaining(Math.floor(data.remaining_hours * 3600));
        setSessionProgress(0); // Reset progress for new session
        setIsMining(true);
      } else {
        // Fallback: Reset local session but keep mining
        setSessionStartTime(Date.now());
        setSessionProgress(0); // Reset progress
      }

      // Update user balance from response
      if (data.new_balance && userData) {
        setUserData(prev => ({
          ...prev,
          prc_balance: data.new_balance,
          total_mined: data.total_mined || prev.total_mined
        }));
      }

      // Refresh user data after a brief delay to ensure cache is cleared
      setTimeout(() => fetchUserData(), 1000);
    } catch (error) {
      var _error$response2, _error$response2$data;
      console.error('Claim error:', error);
      const errorMsg = ((_error$response2 = error.response) === null || _error$response2 === void 0 ? void 0 : (_error$response2$data = _error$response2.data) === null || _error$response2$data === void 0 ? void 0 : _error$response2$data.detail) || 'Failed to collect rewards';
      _utils_smartToast__WEBPACK_IMPORTED_MODULE_15__["default"].error(errorMsg);
    } finally {
      setIsCollecting(false);
    }
  };
  const formatTime = seconds => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  if (loading) {
    return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
      className: "min-h-screen bg-zinc-950 flex items-center justify-center",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
        className: "w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 612,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 611,
      columnNumber: 7
    }, undefined);
  }

  // Get subscription plan info - use existing subscriptionPlan from state
  const hasPaidPlan = ['startup', 'growth', 'elite'].includes(subscriptionPlan);

  // Get multiplier display
  const getMultiplierDisplay = plan => {
    const multipliers = {
      'explorer': '1x',
      'startup': '1.5x',
      'growth': '2x',
      'elite': '3x'
    };
    return multipliers[plan] || '1x';
  };
  const canCollect = sessionPRC >= 0.01;
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
    className: "min-h-screen bg-zinc-950 pb-24",
    children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
      className: "px-5 pb-4 pt-20",
      style: {
        paddingTop: 'max(5rem, calc(env(safe-area-inset-top, 0px) + 4rem))'
      },
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
        className: "flex items-center gap-4",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("button", {
          onClick: () => navigate('/dashboard'),
          className: "w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_4__["default"], {
            className: "w-5 h-5 text-zinc-400"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 642,
            columnNumber: 13
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 638,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("h1", {
            className: "text-zinc-100 text-xl font-semibold tracking-tight",
            children: globalT('dailyRewards')
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 645,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: "text-zinc-500 text-sm",
            children: globalT('collectRewards')
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 646,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 644,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 637,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 636,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
      className: "px-5 mb-6",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
        initial: {
          opacity: 0,
          y: 20
        },
        animate: {
          opacity: 1,
          y: 0
        },
        className: `relative overflow-hidden rounded-[2rem] p-6 backdrop-blur-xl border transition-all duration-500 ${isMining ? 'bg-zinc-900/80 border-amber-500/30 shadow-[0_0_40px_-10px_rgba(251,191,36,0.2)]' : 'bg-zinc-900/40 border-zinc-800 shadow-2xl shadow-black/40'}`,
        children: [isMining && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "absolute inset-0 opacity-20 pointer-events-none",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "absolute top-0 right-0 w-64 h-64 bg-amber-500 rounded-full blur-[100px]"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 667,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "absolute bottom-0 left-0 w-48 h-48 bg-amber-400 rounded-full blur-[80px]"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 668,
            columnNumber: 15
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 666,
          columnNumber: 13
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_17__.AnimatePresence, {
          children: showConfetti && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "absolute inset-0 flex items-center justify-center pointer-events-none z-50",
            children: [...Array(12)].map((_, i) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(ConfettiParticle, {
              index: i,
              onComplete: () => setShowConfetti(false)
            }, i, false, {
              fileName: _jsxFileName,
              lineNumber: 677,
              columnNumber: 19
            }, undefined))
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 675,
            columnNumber: 15
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 673,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "relative z-10",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "flex items-center justify-between mb-6",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: `px-4 py-2 rounded-full border ${isMining ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-800/50 border-zinc-700'}`,
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
                className: `text-sm font-medium flex items-center gap-2 ${isMining ? 'text-emerald-400' : 'text-zinc-400'}`,
                children: isMining ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.Fragment, {
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
                    animate: {
                      opacity: [1, 0.5, 1]
                    },
                    transition: {
                      duration: 2,
                      repeat: Infinity
                    },
                    children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_13__["default"], {
                      className: "w-4 h-4"
                    }, void 0, false, {
                      fileName: _jsxFileName,
                      lineNumber: 700,
                      columnNumber: 25
                    }, undefined)
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 696,
                    columnNumber: 23
                  }, undefined), globalT('sessionActive')]
                }, void 0, true) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.Fragment, {
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_5__["default"], {
                    className: "w-4 h-4"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 705,
                    columnNumber: 23
                  }, undefined), " Ready"]
                }, void 0, true)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 691,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 686,
              columnNumber: 15
            }, undefined), hasPaidPlan && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
                className: "text-xs font-semibold text-amber-400 flex items-center gap-1",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_7__["default"], {
                  className: "w-3 h-3"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 712,
                  columnNumber: 21
                }, undefined), " ", getMultiplierDisplay(subscriptionPlan), " BONUS"]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 711,
                columnNumber: 19
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 710,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 685,
            columnNumber: 13
          }, undefined), isMining ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "text-center mb-6",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
              className: "text-zinc-500 text-sm mb-2",
              children: globalT('timeRemaining')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 721,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "text-5xl font-semibold text-zinc-100 font-mono tracking-wider",
              children: formatTime(sessionTimeRemaining)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 722,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "mt-6 bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-5 relative overflow-hidden border border-zinc-700/50",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-500 text-xs mb-2 relative z-10",
                children: globalT('sessionEarnings')
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 729,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
                className: "flex items-center justify-center gap-3 relative z-10",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_6__["default"], {
                  className: "w-6 h-6 text-amber-500"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 732,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
                  className: "text-4xl font-semibold text-amber-400 font-mono tabular-nums tracking-wide",
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(AnimatedCounter, {
                    value: sessionPRC,
                    decimals: 4
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 736,
                    columnNumber: 23
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 735,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
                  className: "text-lg font-medium text-amber-500/70",
                  children: "PRC"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 738,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_17__.AnimatePresence, {
                  children: showFloatingCoin && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(FloatingCoin, {
                    onComplete: () => setShowFloatingCoin(false)
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 745,
                    columnNumber: 25
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 743,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 730,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
                className: "flex items-center justify-center gap-2 mt-3 relative z-10",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_13__["default"], {
                  className: "w-3 h-3 text-emerald-500"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 752,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                  className: "text-emerald-500 text-xs font-mono",
                  children: ["+", (miningRate / 3600).toFixed(6), " PRC/sec"]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 753,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 751,
                columnNumber: 19
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
                className: "mt-4 relative z-10",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
                  className: "flex justify-between text-xs text-zinc-500 mb-1.5",
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
                    children: "Session Progress"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 761,
                    columnNumber: 23
                  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
                    className: "text-amber-400 font-mono",
                    children: [sessionProgress.toFixed(1), "%"]
                  }, void 0, true, {
                    fileName: _jsxFileName,
                    lineNumber: 762,
                    columnNumber: 23
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 760,
                  columnNumber: 21
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
                  className: "h-1.5 bg-zinc-700 rounded-full overflow-hidden",
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
                    className: "h-full rounded-full",
                    initial: {
                      width: 0
                    },
                    animate: {
                      width: `${sessionProgress}%`
                    },
                    transition: {
                      duration: 0.5,
                      ease: "easeOut"
                    },
                    style: {
                      background: 'linear-gradient(90deg, #10b981, #34d399)',
                      boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
                    }
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 765,
                    columnNumber: 23
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 764,
                  columnNumber: 21
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 759,
                columnNumber: 19
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 727,
              columnNumber: 17
            }, undefined), isFreeUser ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "mt-6 bg-gradient-to-br from-amber-900/30 to-orange-900/20 rounded-2xl p-4 border border-amber-500/30",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
                className: "flex items-center gap-3 mb-3",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_7__["default"], {
                  className: "w-6 h-6 text-amber-400"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 783,
                  columnNumber: 23
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
                  children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                    className: "text-amber-400 font-semibold text-sm",
                    children: "Upgrade to Collect PRC!"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 785,
                    columnNumber: 25
                  }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                    className: "text-gray-400 text-xs",
                    children: ["\u0924\u0941\u092E\u091A\u0947 ", sessionPRC.toFixed(2), " PRC collect \u0915\u0930\u0923\u094D\u092F\u093E\u0938\u093E\u0920\u0940 plan upgrade \u0915\u0930\u093E"]
                  }, void 0, true, {
                    fileName: _jsxFileName,
                    lineNumber: 786,
                    columnNumber: 25
                  }, undefined)]
                }, void 0, true, {
                  fileName: _jsxFileName,
                  lineNumber: 784,
                  columnNumber: 23
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 782,
                columnNumber: 21
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(_components_ui_button__WEBPACK_IMPORTED_MODULE_2__.Button, {
                onClick: () => navigate('/subscription'),
                className: "w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-3 rounded-xl",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_7__["default"], {
                  className: "w-4 h-4 mr-2"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 793,
                  columnNumber: 23
                }, undefined), "Upgrade Now"]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 789,
                columnNumber: 21
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 781,
              columnNumber: 19
            }, undefined) :
            /*#__PURE__*/
            /* Collect Button - Gold Gradient - PAID USERS ONLY */
            (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(_components_ui_button__WEBPACK_IMPORTED_MODULE_2__.Button, {
              onClick: collectRewards,
              disabled: !canCollect || isCollecting,
              className: `mt-6 w-full py-4 rounded-xl font-semibold text-lg transition-all active:scale-[0.98] ${canCollect ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] border border-amber-400/50' : 'bg-zinc-800 text-zinc-600 border border-zinc-700 cursor-not-allowed'}`,
              children: isCollecting ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
                className: "flex items-center gap-2 justify-center",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
                  className: "w-5 h-5 border-2 border-black border-t-transparent rounded-full",
                  animate: {
                    rotate: 360
                  },
                  transition: {
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear"
                  }
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 810,
                  columnNumber: 25
                }, undefined), globalT('collecting')]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 809,
                columnNumber: 23
              }, undefined) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
                className: "flex items-center gap-2 justify-center",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_3__["default"], {
                  className: "w-5 h-5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 819,
                  columnNumber: 25
                }, undefined), globalT('collectRewards'), " (", sessionPRC.toFixed(2), " PRC)"]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 818,
                columnNumber: 23
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 799,
              columnNumber: 19
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 720,
            columnNumber: 15
          }, undefined) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "text-center mb-6",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
              className: "w-24 h-24 mx-auto mb-4 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center",
              animate: {
                scale: [1, 1.03, 1]
              },
              transition: {
                duration: 2,
                repeat: Infinity
              },
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_11__["default"], {
                className: "w-12 h-12 text-amber-500"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 833,
                columnNumber: 19
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 828,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
              className: "text-zinc-400 mb-4",
              children: globalT('startEarning')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 835,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(_components_ui_button__WEBPACK_IMPORTED_MODULE_2__.Button, {
              onClick: startSession,
              disabled: isStarting,
              className: "w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-500/50 active:scale-[0.98] transition-all",
              children: isStarting ? /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
                className: "flex items-center gap-2 justify-center",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
                  className: "w-5 h-5 border-2 border-white border-t-transparent rounded-full",
                  animate: {
                    rotate: 360
                  },
                  transition: {
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear"
                  }
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 843,
                  columnNumber: 23
                }, undefined), globalT('processing'), "..."]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 842,
                columnNumber: 21
              }, undefined) : /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
                className: "flex items-center gap-2 justify-center",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_10__["default"], {
                  className: "w-5 h-5"
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 852,
                  columnNumber: 23
                }, undefined), globalT('startSession')]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 851,
                columnNumber: 21
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 836,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 827,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "grid grid-cols-2 gap-3 mt-6",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-4 text-center border border-zinc-700/50",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
                className: "flex items-center justify-center gap-1 mb-1",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                  className: "text-zinc-500 text-xs",
                  children: globalT('currentBalance')
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 864,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(_components_InfoTooltip__WEBPACK_IMPORTED_MODULE_20__.InfoTooltip, {
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                    children: "Your available PRC balance that can be used for bill payments, vouchers, and marketplace purchases"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 866,
                    columnNumber: 21
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 865,
                  columnNumber: 19
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 863,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-2xl font-semibold text-zinc-100 font-mono tabular-nums",
                children: ((userData === null || userData === void 0 ? void 0 : userData.prc_balance) || 0).toFixed(2)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 869,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-amber-500 text-sm",
                children: "PRC"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 870,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 862,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "bg-zinc-800/50 backdrop-blur-sm rounded-2xl p-4 text-center border border-zinc-700/50",
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
                className: "flex items-center justify-center gap-1 mb-1",
                children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                  className: "text-zinc-500 text-xs",
                  children: globalT('rewardRate')
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 874,
                  columnNumber: 19
                }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(_components_InfoTooltip__WEBPACK_IMPORTED_MODULE_20__.InfoTooltip, {
                  children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                    children: "PRC earned per hour. Rate increases with your subscription plan and referral bonuses"
                  }, void 0, false, {
                    fileName: _jsxFileName,
                    lineNumber: 876,
                    columnNumber: 21
                  }, undefined)
                }, void 0, false, {
                  fileName: _jsxFileName,
                  lineNumber: 875,
                  columnNumber: 19
                }, undefined)]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 873,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-2xl font-semibold text-zinc-100 font-mono tabular-nums",
                children: miningRate.toFixed(1)
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 879,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-emerald-500 text-sm",
                children: globalT('perHour')
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 880,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 872,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 861,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 683,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 655,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 654,
      columnNumber: 7
    }, undefined), !hasPaidPlan && /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
      className: "px-5 mb-6",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
        className: "bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4",
        children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "flex items-start gap-3",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_5__["default"], {
            className: "w-5 h-5 text-amber-500 mt-0.5"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 892,
            columnNumber: 15
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
              className: "text-amber-400 font-medium text-sm",
              children: globalT('freeUserWarning')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 894,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("button", {
              onClick: () => navigate('/subscription'),
              className: "text-amber-500 text-xs mt-1 underline hover:text-amber-400",
              children: [globalT('upgradeToVip'), " \u2192"]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 895,
              columnNumber: 17
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 893,
            columnNumber: 15
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 891,
          columnNumber: 13
        }, undefined)
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 890,
        columnNumber: 11
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 889,
      columnNumber: 9
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
      className: "px-5 mb-6",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("h2", {
        className: "text-zinc-100 font-semibold text-lg mb-4",
        children: globalT('yourStats')
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 909,
        columnNumber: 9
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
        className: "grid grid-cols-2 gap-3",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
          initial: {
            opacity: 0,
            y: 20
          },
          animate: {
            opacity: 1,
            y: 0
          },
          transition: {
            delay: 0.1
          },
          className: "bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-4",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_12__["default"], {
            className: "w-7 h-7 text-emerald-500 mb-2"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 917,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "flex items-center gap-1",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
              className: "text-zinc-500 text-xs",
              children: "Lifetime Earnings"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 919,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(_components_InfoTooltip__WEBPACK_IMPORTED_MODULE_20__.InfoTooltip, {
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                children: "Includes: Mining rewards, Referral bonuses, Tap Game & Cashback"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 921,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 920,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 918,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: "text-xl font-semibold text-zinc-100 font-mono tabular-nums",
            children: (lifetimeEarnings + sessionPRC).toFixed(2)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 924,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: "text-emerald-500 text-xs",
            children: "PRC"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 925,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 911,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_18__.motion.div, {
          initial: {
            opacity: 0,
            y: 20
          },
          animate: {
            opacity: 1,
            y: 0
          },
          transition: {
            delay: 0.2
          },
          className: "bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-4",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_8__["default"], {
            className: "w-7 h-7 text-amber-500 mb-2"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 933,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "flex items-center gap-1",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
              className: "text-zinc-500 text-xs",
              children: globalT('referralWeight')
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 935,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(_components_InfoTooltip__WEBPACK_IMPORTED_MODULE_20__.InfoTooltip, {
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                children: "Bonus mining rate from your paid referrals. Each paid referral adds +10% to your mining speed (max 100%)"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 937,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 936,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 934,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: "text-xl font-semibold text-zinc-100 font-mono tabular-nums",
            children: ["+", Math.min(((userData === null || userData === void 0 ? void 0 : userData.referral_count) || 0) * 10, 100), "%"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 940,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 927,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 910,
        columnNumber: 9
      }, undefined)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 908,
      columnNumber: 7
    }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
      className: "px-5",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("h2", {
        className: "text-zinc-100 font-semibold text-lg mb-4 flex items-center gap-2",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_12__["default"], {
          className: "w-5 h-5 text-amber-400"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 948,
          columnNumber: 11
        }, undefined), "Mining Speed Breakdown"]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 947,
        columnNumber: 9
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
        className: "bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-4 space-y-3",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "flex items-center justify-between py-2 border-b border-zinc-800/50",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "flex items-center gap-3",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_6__["default"], {
                className: "w-4 h-4 text-emerald-400"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 956,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 955,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-200 text-sm font-medium",
                children: "Your Mining"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 959,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-500 text-xs",
                children: "Base rate"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 960,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 958,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 954,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: "text-emerald-400 font-mono text-sm font-semibold",
            children: [baseRate.toFixed(2), " PRC/hr"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 963,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 953,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "flex items-center justify-between py-2 border-b border-zinc-800/50",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "flex items-center gap-3",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold",
              children: "L1"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 971,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-200 text-sm font-medium",
                children: "Level 1 Referrals"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 973,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-500 text-xs",
                children: [(referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le = referralBreakdown.level_1) === null || _referralBreakdown$le === void 0 ? void 0 : _referralBreakdown$le.total_count) || 0, " invited \u2022 ", (referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le2 = referralBreakdown.level_1) === null || _referralBreakdown$le2 === void 0 ? void 0 : _referralBreakdown$le2.active_count) || 0, " active \u2022 ", ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le3 = referralBreakdown.level_1) === null || _referralBreakdown$le3 === void 0 ? void 0 : _referralBreakdown$le3.total_count) || 0) - ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le4 = referralBreakdown.level_1) === null || _referralBreakdown$le4 === void 0 ? void 0 : _referralBreakdown$le4.active_count) || 0), " inactive"]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 974,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 972,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 970,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: `font-mono text-sm font-semibold ${((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le5 = referralBreakdown.level_1) === null || _referralBreakdown$le5 === void 0 ? void 0 : _referralBreakdown$le5.bonus) || 0) > 0 ? 'text-blue-400' : 'text-zinc-600'}`,
            children: ["+", ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le6 = referralBreakdown.level_1) === null || _referralBreakdown$le6 === void 0 ? void 0 : _referralBreakdown$le6.bonus) || 0).toFixed(2), " PRC/hr"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 979,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 969,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "flex items-center justify-between py-2 border-b border-zinc-800/50",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "flex items-center gap-3",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold",
              children: "L2"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 987,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-200 text-sm font-medium",
                children: "Level 2 Referrals"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 989,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-500 text-xs",
                children: [(referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le7 = referralBreakdown.level_2) === null || _referralBreakdown$le7 === void 0 ? void 0 : _referralBreakdown$le7.total_count) || 0, " invited \u2022 ", (referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le8 = referralBreakdown.level_2) === null || _referralBreakdown$le8 === void 0 ? void 0 : _referralBreakdown$le8.active_count) || 0, " active \u2022 ", ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le9 = referralBreakdown.level_2) === null || _referralBreakdown$le9 === void 0 ? void 0 : _referralBreakdown$le9.total_count) || 0) - ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le0 = referralBreakdown.level_2) === null || _referralBreakdown$le0 === void 0 ? void 0 : _referralBreakdown$le0.active_count) || 0), " inactive"]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 990,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 988,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 986,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: `font-mono text-sm font-semibold ${((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le1 = referralBreakdown.level_2) === null || _referralBreakdown$le1 === void 0 ? void 0 : _referralBreakdown$le1.bonus) || 0) > 0 ? 'text-purple-400' : 'text-zinc-600'}`,
            children: ["+", ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le10 = referralBreakdown.level_2) === null || _referralBreakdown$le10 === void 0 ? void 0 : _referralBreakdown$le10.bonus) || 0).toFixed(2), " PRC/hr"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 995,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 985,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "flex items-center justify-between py-2 border-b border-zinc-800/50",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "flex items-center gap-3",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 text-xs font-bold",
              children: "L3"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1003,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-200 text-sm font-medium",
                children: "Level 3 Referrals"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1005,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-500 text-xs",
                children: [(referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le11 = referralBreakdown.level_3) === null || _referralBreakdown$le11 === void 0 ? void 0 : _referralBreakdown$le11.total_count) || 0, " invited \u2022 ", (referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le12 = referralBreakdown.level_3) === null || _referralBreakdown$le12 === void 0 ? void 0 : _referralBreakdown$le12.active_count) || 0, " active \u2022 ", ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le13 = referralBreakdown.level_3) === null || _referralBreakdown$le13 === void 0 ? void 0 : _referralBreakdown$le13.total_count) || 0) - ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le14 = referralBreakdown.level_3) === null || _referralBreakdown$le14 === void 0 ? void 0 : _referralBreakdown$le14.active_count) || 0), " inactive"]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 1006,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 1004,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1002,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: `font-mono text-sm font-semibold ${((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le15 = referralBreakdown.level_3) === null || _referralBreakdown$le15 === void 0 ? void 0 : _referralBreakdown$le15.bonus) || 0) > 0 ? 'text-orange-400' : 'text-zinc-600'}`,
            children: ["+", ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le16 = referralBreakdown.level_3) === null || _referralBreakdown$le16 === void 0 ? void 0 : _referralBreakdown$le16.bonus) || 0).toFixed(2), " PRC/hr"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1011,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 1001,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "flex items-center justify-between py-2 border-b border-zinc-800/50",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "flex items-center gap-3",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400 text-xs font-bold",
              children: "L4"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1019,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-200 text-sm font-medium",
                children: "Level 4 Referrals"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1021,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-500 text-xs",
                children: [(referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le17 = referralBreakdown.level_4) === null || _referralBreakdown$le17 === void 0 ? void 0 : _referralBreakdown$le17.total_count) || 0, " invited \u2022 ", (referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le18 = referralBreakdown.level_4) === null || _referralBreakdown$le18 === void 0 ? void 0 : _referralBreakdown$le18.active_count) || 0, " active \u2022 ", ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le19 = referralBreakdown.level_4) === null || _referralBreakdown$le19 === void 0 ? void 0 : _referralBreakdown$le19.total_count) || 0) - ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le20 = referralBreakdown.level_4) === null || _referralBreakdown$le20 === void 0 ? void 0 : _referralBreakdown$le20.active_count) || 0), " inactive"]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 1022,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 1020,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1018,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: `font-mono text-sm font-semibold ${((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le21 = referralBreakdown.level_4) === null || _referralBreakdown$le21 === void 0 ? void 0 : _referralBreakdown$le21.bonus) || 0) > 0 ? 'text-pink-400' : 'text-zinc-600'}`,
            children: ["+", ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le22 = referralBreakdown.level_4) === null || _referralBreakdown$le22 === void 0 ? void 0 : _referralBreakdown$le22.bonus) || 0).toFixed(2), " PRC/hr"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1027,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 1017,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "flex items-center justify-between py-2 border-b border-zinc-800/50",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "flex items-center gap-3",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold",
              children: "L5"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1035,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-200 text-sm font-medium",
                children: "Level 5 Referrals"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1037,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-500 text-xs",
                children: [(referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le23 = referralBreakdown.level_5) === null || _referralBreakdown$le23 === void 0 ? void 0 : _referralBreakdown$le23.total_count) || 0, " invited \u2022 ", (referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le24 = referralBreakdown.level_5) === null || _referralBreakdown$le24 === void 0 ? void 0 : _referralBreakdown$le24.active_count) || 0, " active \u2022 ", ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le25 = referralBreakdown.level_5) === null || _referralBreakdown$le25 === void 0 ? void 0 : _referralBreakdown$le25.total_count) || 0) - ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le26 = referralBreakdown.level_5) === null || _referralBreakdown$le26 === void 0 ? void 0 : _referralBreakdown$le26.active_count) || 0), " inactive"]
              }, void 0, true, {
                fileName: _jsxFileName,
                lineNumber: 1038,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 1036,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1034,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: `font-mono text-sm font-semibold ${((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le27 = referralBreakdown.level_5) === null || _referralBreakdown$le27 === void 0 ? void 0 : _referralBreakdown$le27.bonus) || 0) > 0 ? 'text-cyan-400' : 'text-zinc-600'}`,
            children: ["+", ((referralBreakdown === null || referralBreakdown === void 0 ? void 0 : (_referralBreakdown$le28 = referralBreakdown.level_5) === null || _referralBreakdown$le28 === void 0 ? void 0 : _referralBreakdown$le28.bonus) || 0).toFixed(2), " PRC/hr"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1043,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 1033,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "flex items-center justify-between pt-3 mt-2 border-t-2 border-amber-500/30",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
            className: "flex items-center gap-3",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              className: "w-8 h-8 rounded-lg bg-amber-500/30 flex items-center justify-center",
              children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_13__["default"], {
                className: "w-4 h-4 text-amber-400"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1052,
                columnNumber: 17
              }, undefined)
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1051,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
              children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-amber-400 text-sm font-bold",
                children: "TOTAL SPEED"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1055,
                columnNumber: 17
              }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
                className: "text-zinc-500 text-xs",
                children: "Per hour mining"
              }, void 0, false, {
                fileName: _jsxFileName,
                lineNumber: 1056,
                columnNumber: 17
              }, undefined)]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 1054,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1050,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: "text-amber-400 font-mono text-lg font-bold",
            children: [miningRate.toFixed(2), " PRC/hr"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1059,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 1049,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("div", {
          className: "mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("p", {
            className: "text-blue-300 text-xs flex items-start gap-2",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_9__["default"], {
              className: "w-4 h-4 flex-shrink-0 mt-0.5"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1067,
              columnNumber: 15
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_21__.jsxDEV)("span", {
              children: "Bonus is calculated from active PAID users only. Free users don't contribute to mining speed."
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 1068,
              columnNumber: 15
            }, undefined)]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 1066,
            columnNumber: 13
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 1065,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 951,
        columnNumber: 9
      }, undefined)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 946,
      columnNumber: 7
    }, undefined)]
  }, void 0, true, {
    fileName: _jsxFileName,
    lineNumber: 634,
    columnNumber: 5
  }, undefined);
};
_s2(DailyRewards, "EV9iU2JeavbAcprxTojCQ0sdbMU=", false, function () {
  return [react_router_dom__WEBPACK_IMPORTED_MODULE_16__.useNavigate, _contexts_LanguageContext__WEBPACK_IMPORTED_MODULE_19__.useLanguage, _contexts_LanguageContext__WEBPACK_IMPORTED_MODULE_19__.useLanguage];
});
_c10 = DailyRewards;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (DailyRewards);
var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c0, _c1, _c10;
__webpack_require__.$Refresh$.register(_c, "AnimatedCounter");
__webpack_require__.$Refresh$.register(_c2, "FloatingCoin");
__webpack_require__.$Refresh$.register(_c3, "SparkleParticle");
__webpack_require__.$Refresh$.register(_c4, "PulseRing");
__webpack_require__.$Refresh$.register(_c5, "FlipDigit");
__webpack_require__.$Refresh$.register(_c6, "RainbowBorder");
__webpack_require__.$Refresh$.register(_c7, "OrbitingCoin");
__webpack_require__.$Refresh$.register(_c8, "ConfettiParticle");
__webpack_require__.$Refresh$.register(_c9, "AuroraBackground");
__webpack_require__.$Refresh$.register(_c0, "FloatingBubble");
__webpack_require__.$Refresh$.register(_c1, "GlowingShadow");
__webpack_require__.$Refresh$.register(_c10, "DailyRewards");

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ }),

/***/ "./src/utils/smartToast.js":
/*!*********************************!*\
  !*** ./src/utils/smartToast.js ***!
  \*********************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   smartToast: () => (/* binding */ smartToast)
/* harmony export */ });
/* harmony import */ var sonner__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sonner */ "./node_modules/sonner/dist/index.mjs");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

/**
 * Smart Toast Manager - Prevents duplicate and excessive toasts
 * Replaces direct toast() calls to reduce notification spam
 */


// Track recent toasts to prevent duplicates
const recentToasts = new Map();
const DUPLICATE_THRESHOLD = 3000; // 3 seconds - don't show same toast within this window
const MAX_TOASTS_PER_MINUTE = 5; // Maximum toasts allowed per minute
let toastCountThisMinute = 0;
let lastMinuteReset = Date.now();

// Reset counter every minute
const resetCounterIfNeeded = () => {
  const now = Date.now();
  if (now - lastMinuteReset > 60000) {
    toastCountThisMinute = 0;
    lastMinuteReset = now;
  }
};

// Generate a hash for the toast message
const getToastHash = (message, type) => {
  const str = `${type}:${typeof message === 'string' ? message : JSON.stringify(message)}`;
  return str.slice(0, 100); // Truncate for efficiency
};

// Check if toast should be shown
const shouldShowToast = (message, type) => {
  resetCounterIfNeeded();

  // Rate limit check
  if (toastCountThisMinute >= MAX_TOASTS_PER_MINUTE) {
    console.log('[SmartToast] Rate limit reached, suppressing toast');
    return false;
  }

  // Duplicate check
  const hash = getToastHash(message, type);
  const lastShown = recentToasts.get(hash);
  const now = Date.now();
  if (lastShown && now - lastShown < DUPLICATE_THRESHOLD) {
    console.log('[SmartToast] Duplicate toast suppressed:', message);
    return false;
  }

  // Update tracking
  recentToasts.set(hash, now);
  toastCountThisMinute++;

  // Cleanup old entries (keep map size manageable)
  if (recentToasts.size > 50) {
    const oldestAllowed = now - DUPLICATE_THRESHOLD;
    for (const [key, time] of recentToasts.entries()) {
      if (time < oldestAllowed) {
        recentToasts.delete(key);
      }
    }
  }
  return true;
};

// Smart toast wrapper functions
const smartToast = {
  success: (message, options = {}) => {
    if (shouldShowToast(message, 'success')) {
      return sonner__WEBPACK_IMPORTED_MODULE_0__.toast.success(message, {
        duration: 2500,
        ...options
      });
    }
  },
  error: (message, options = {}) => {
    // Always show errors (but still prevent duplicates)
    if (shouldShowToast(message, 'error')) {
      return sonner__WEBPACK_IMPORTED_MODULE_0__.toast.error(message, {
        duration: 4000,
        ...options
      });
    }
  },
  info: (message, options = {}) => {
    if (shouldShowToast(message, 'info')) {
      return sonner__WEBPACK_IMPORTED_MODULE_0__.toast.info(message, {
        duration: 2500,
        ...options
      });
    }
  },
  warning: (message, options = {}) => {
    if (shouldShowToast(message, 'warning')) {
      return sonner__WEBPACK_IMPORTED_MODULE_0__.toast.warning(message, {
        duration: 3000,
        ...options
      });
    }
  },
  // For critical messages that should always show
  critical: (message, options = {}) => {
    toastCountThisMinute = Math.max(0, toastCountThisMinute - 1); // Don't count against limit
    return sonner__WEBPACK_IMPORTED_MODULE_0__.toast.error(message, {
      duration: 5000,
      ...options
    });
  },
  // Loading toast
  loading: (message, options = {}) => {
    return sonner__WEBPACK_IMPORTED_MODULE_0__.toast.loading(message, options);
  },
  // Dismiss toast
  dismiss: toastId => {
    return sonner__WEBPACK_IMPORTED_MODULE_0__.toast.dismiss(toastId);
  },
  // Promise toast
  promise: (promise, messages, options = {}) => {
    return sonner__WEBPACK_IMPORTED_MODULE_0__.toast.promise(promise, messages, options);
  }
};

// Export for direct import
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (smartToast);

const $ReactRefreshModuleId$ = __webpack_require__.$Refresh$.moduleId;
const $ReactRefreshCurrentExports$ = __react_refresh_utils__.getModuleExports(
	$ReactRefreshModuleId$
);

function $ReactRefreshModuleRuntime$(exports) {
	if (true) {
		let errorOverlay;
		if (true) {
			errorOverlay = false;
		}
		let testMode;
		if (typeof __react_refresh_test__ !== 'undefined') {
			testMode = __react_refresh_test__;
		}
		return __react_refresh_utils__.executeRuntime(
			exports,
			$ReactRefreshModuleId$,
			module.hot,
			errorOverlay,
			testMode
		);
	}
}

if (typeof Promise !== 'undefined' && $ReactRefreshCurrentExports$ instanceof Promise) {
	$ReactRefreshCurrentExports$.then($ReactRefreshModuleRuntime$);
} else {
	$ReactRefreshModuleRuntime$($ReactRefreshCurrentExports$);
}

/***/ })

}]);
//# sourceMappingURL=src_pages_Mining_js-node_modules_radix-ui_react-slot_dist_index_mjs.chunk.js.map