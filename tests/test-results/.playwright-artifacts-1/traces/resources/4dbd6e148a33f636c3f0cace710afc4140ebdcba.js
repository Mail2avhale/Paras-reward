"use strict";
(globalThis["webpackChunkfrontend"] = globalThis["webpackChunkfrontend"] || []).push([["src_components_ProfileCompletionComponents_jsx"],{

/***/ "./src/components/ProfileCompletionComponents.jsx":
/*!********************************************************!*\
  !*** ./src/components/ProfileCompletionComponents.jsx ***!
  \********************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ProfileCompletionRing: () => (/* binding */ ProfileCompletionRing),
/* harmony export */   ProfileFloatingReminder: () => (/* binding */ ProfileFloatingReminder),
/* harmony export */   RedemptionProfilePrompt: () => (/* binding */ RedemptionProfilePrompt),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! framer-motion */ "./node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs");
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! framer-motion */ "./node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs");
/* harmony import */ var react_router_dom__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react-router-dom */ "./node_modules/react-router/dist/development/chunk-OIYGIGL5.mjs");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/chevron-right.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/map-pin.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/phone.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/shield.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/user.js");
/* harmony import */ var lucide_react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! lucide-react */ "./node_modules/lucide-react/dist/esm/icons/x.js");
/* harmony import */ var _ui_button__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./ui/button */ "./src/components/ui/button.jsx");
/* harmony import */ var _ui_card__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./ui/card */ "./src/components/ui/card.jsx");
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/ProfileCompletionComponents.jsx",
  _s = __webpack_require__.$Refresh$.signature(),
  _s2 = __webpack_require__.$Refresh$.signature(),
  _s3 = __webpack_require__.$Refresh$.signature();







// ============================================
// 1. PROFILE COMPLETION PROGRESS RING
// ============================================

const ProfileCompletionRing = ({
  user,
  userData,
  onComplete
}) => {
  _s();
  const navigate = (0,react_router_dom__WEBPACK_IMPORTED_MODULE_3__.useNavigate)();

  // Merge user and userData for checking
  const data = {
    ...user,
    ...userData
  };

  // Calculate profile completion percentage
  const getCompletionData = () => {
    const checks = [{
      id: 'name',
      label: 'Full Name',
      done: !!(data !== null && data !== void 0 && data.name && data.name.trim() !== ''),
      points: 20,
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_8__["default"]
    }, {
      id: 'mobile',
      label: 'Mobile Number',
      done: !!(data !== null && data !== void 0 && data.mobile && data.mobile.trim() !== ''),
      points: 25,
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_6__["default"]
    }, {
      id: 'location',
      label: 'Location',
      done: !!(data !== null && data !== void 0 && data.city || data !== null && data !== void 0 && data.district || data !== null && data !== void 0 && data.state),
      points: 15,
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_5__["default"]
    }, {
      id: 'kyc',
      label: 'KYC Verified',
      done: (data === null || data === void 0 ? void 0 : data.kyc_status) === 'verified',
      points: 40,
      icon: lucide_react__WEBPACK_IMPORTED_MODULE_7__["default"]
    }];
    const completed = checks.filter(c => c.done);
    const totalPoints = checks.reduce((sum, c) => sum + c.points, 0);
    const earnedPoints = completed.reduce((sum, c) => sum + c.points, 0);
    const percentage = Math.round(earnedPoints / totalPoints * 100);
    return {
      checks,
      percentage,
      earnedPoints,
      totalPoints,
      incompleteChecks: checks.filter(c => !c.done)
    };
  };
  const {
    checks,
    percentage,
    incompleteChecks
  } = getCompletionData();
  const isComplete = percentage === 100;

  // SVG Circle parameters
  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - percentage / 100 * circumference;

  // Get color based on percentage
  const getColor = () => {
    if (percentage >= 100) return '#10b981'; // emerald
    if (percentage >= 70) return '#8b5cf6'; // purple
    if (percentage >= 40) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  // Don't show if profile is complete (100%)
  if (isComplete) return null;
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(_ui_card__WEBPACK_IMPORTED_MODULE_11__.Card, {
    className: "p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 mb-4",
    children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
      className: "flex items-center gap-3",
      children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
        className: "relative flex-shrink-0",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("svg", {
          width: size,
          height: size,
          className: "transform -rotate-90",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("circle", {
            cx: size / 2,
            cy: size / 2,
            r: radius,
            fill: "none",
            stroke: "#374151",
            strokeWidth: strokeWidth
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 65,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_2__.motion.circle, {
            cx: size / 2,
            cy: size / 2,
            r: radius,
            fill: "none",
            stroke: getColor(),
            strokeWidth: strokeWidth,
            strokeLinecap: "round",
            strokeDasharray: circumference,
            initial: {
              strokeDashoffset: circumference
            },
            animate: {
              strokeDashoffset: offset
            },
            transition: {
              duration: 1,
              ease: "easeOut"
            }
          }, percentage, false, {
            fileName: _jsxFileName,
            lineNumber: 74,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 63,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
          className: "absolute inset-0 flex flex-col items-center justify-center",
          children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("span", {
            className: "text-xl font-bold text-white",
            children: [percentage, "%"]
          }, void 0, true, {
            fileName: _jsxFileName,
            lineNumber: 91,
            columnNumber: 13
          }, undefined)
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 90,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 62,
        columnNumber: 9
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
        className: "flex-1 min-w-0",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
          className: "flex flex-wrap gap-1 mb-2",
          children: incompleteChecks.slice(0, 3).map(check => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("span", {
            className: "px-2 py-0.5 bg-gray-800 text-gray-400 text-[10px] rounded-full flex items-center gap-1",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(check.icon, {
              className: "w-3 h-3"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 104,
              columnNumber: 17
            }, undefined), check.label]
          }, check.id, true, {
            fileName: _jsxFileName,
            lineNumber: 100,
            columnNumber: 15
          }, undefined))
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 98,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(_ui_button__WEBPACK_IMPORTED_MODULE_10__.Button, {
          size: "sm",
          onClick: () => navigate('/profile?edit=true'),
          className: "h-7 text-xs bg-purple-600 hover:bg-purple-700",
          children: ["Complete", /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_4__["default"], {
            className: "w-3 h-3 ml-1"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 116,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 110,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 96,
        columnNumber: 9
      }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
        className: "flex flex-col gap-1",
        children: checks.map(check => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
          className: `w-2 h-2 rounded-full ${check.done ? 'bg-emerald-500' : 'bg-gray-600'}`,
          title: check.label
        }, check.id, false, {
          fileName: _jsxFileName,
          lineNumber: 123,
          columnNumber: 13
        }, undefined))
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 121,
        columnNumber: 9
      }, undefined)]
    }, void 0, true, {
      fileName: _jsxFileName,
      lineNumber: 60,
      columnNumber: 7
    }, undefined)
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 59,
    columnNumber: 5
  }, undefined);
};

// ============================================
// 2. GENTLE FLOATING REMINDER
// ============================================
_s(ProfileCompletionRing, "CzcTeTziyjMsSrAVmHuCCb6+Bfg=", false, function () {
  return [react_router_dom__WEBPACK_IMPORTED_MODULE_3__.useNavigate];
});
_c = ProfileCompletionRing;
const ProfileFloatingReminder = ({
  user,
  userData,
  onDismiss
}) => {
  _s2();
  var _user$email;
  const navigate = (0,react_router_dom__WEBPACK_IMPORTED_MODULE_3__.useNavigate)();
  const [visible, setVisible] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const [dismissed, setDismissed] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);

  // Merge user and userData
  const data = {
    ...user,
    ...userData
  };

  // Check if profile is complete
  const isProfileComplete = !!(data !== null && data !== void 0 && data.name && data.name.trim() !== '' && data !== null && data !== void 0 && data.mobile && data.mobile.trim() !== '' && (data !== null && data !== void 0 && data.city || data !== null && data !== void 0 && data.district || data !== null && data !== void 0 && data.state) && (data === null || data === void 0 ? void 0 : data.kyc_status) === 'verified');

  // Check if should show reminder
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    // Don't show if profile is complete
    if (isProfileComplete) {
      setDismissed(true);
      return;
    }
    const lastDismissed = localStorage.getItem('profile_reminder_dismissed');
    const dismissCount = parseInt(localStorage.getItem('profile_reminder_dismiss_count') || '0');

    // If dismissed 3+ times, wait 7 days
    if (dismissCount >= 3) {
      const lastTime = new Date(lastDismissed || 0);
      const daysSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        setDismissed(true);
        return;
      }
    }
    // If dismissed less than 3 times, wait 24 hours
    else if (lastDismissed) {
      const lastTime = new Date(lastDismissed);
      const hoursSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        setDismissed(true);
        return;
      }
    }

    // Show after 3 seconds
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [user, userData, isProfileComplete]);
  const handleDismiss = () => {
    const currentCount = parseInt(localStorage.getItem('profile_reminder_dismiss_count') || '0');
    localStorage.setItem('profile_reminder_dismissed', new Date().toISOString());
    localStorage.setItem('profile_reminder_dismiss_count', String(currentCount + 1));
    setVisible(false);
    onDismiss === null || onDismiss === void 0 ? void 0 : onDismiss();
  };
  const handleComplete = () => {
    setVisible(false);
    navigate('/profile?edit=true');
  };
  const userName = (data === null || data === void 0 ? void 0 : data.name) || (user === null || user === void 0 ? void 0 : (_user$email = user.email) === null || _user$email === void 0 ? void 0 : _user$email.split('@')[0]) || 'there';
  const firstName = userName.split(' ')[0];

  // Don't show if profile complete or dismissed
  if (isProfileComplete || dismissed || !visible) return null;
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
    children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_2__.motion.div, {
      initial: {
        opacity: 0,
        y: 50,
        scale: 0.9
      },
      animate: {
        opacity: 1,
        y: 0,
        scale: 1
      },
      exit: {
        opacity: 0,
        y: 50,
        scale: 0.9
      },
      className: "fixed bottom-24 left-4 right-4 z-40",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(_ui_card__WEBPACK_IMPORTED_MODULE_11__.Card, {
        className: "p-3 bg-gradient-to-r from-gray-900 to-gray-800 border-purple-500/30 shadow-xl shadow-purple-500/10",
        children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
          className: "flex items-center gap-3",
          children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
            className: "w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0",
            children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_8__["default"], {
              className: "w-4 h-4 text-white"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 221,
              columnNumber: 15
            }, undefined)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 220,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
            className: "flex-1 min-w-0",
            children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("p", {
              className: "text-sm text-gray-300",
              children: [firstName, ", complete your profile"]
            }, void 0, true, {
              fileName: _jsxFileName,
              lineNumber: 226,
              columnNumber: 15
            }, undefined)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 225,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(_ui_button__WEBPACK_IMPORTED_MODULE_10__.Button, {
            size: "sm",
            onClick: handleComplete,
            className: "h-7 text-xs bg-purple-600 hover:bg-purple-700",
            children: "Complete"
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 232,
            columnNumber: 13
          }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("button", {
            onClick: handleDismiss,
            className: "text-gray-500 hover:text-white p-1",
            children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(lucide_react__WEBPACK_IMPORTED_MODULE_9__["default"], {
              className: "w-4 h-4"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 245,
              columnNumber: 15
            }, undefined)
          }, void 0, false, {
            fileName: _jsxFileName,
            lineNumber: 241,
            columnNumber: 13
          }, undefined)]
        }, void 0, true, {
          fileName: _jsxFileName,
          lineNumber: 218,
          columnNumber: 11
        }, undefined)
      }, void 0, false, {
        fileName: _jsxFileName,
        lineNumber: 217,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 211,
      columnNumber: 7
    }, undefined)
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 210,
    columnNumber: 5
  }, undefined);
};

// ============================================
// 3. CONTEXTUAL PROMPT FOR REDEMPTION
// ============================================
_s2(ProfileFloatingReminder, "KtjRquwFcQprV2I97km1zVYVKNg=", false, function () {
  return [react_router_dom__WEBPACK_IMPORTED_MODULE_3__.useNavigate];
});
_c2 = ProfileFloatingReminder;
const RedemptionProfilePrompt = ({
  user,
  userData,
  onContinue,
  onComplete
}) => {
  _s3();
  const navigate = (0,react_router_dom__WEBPACK_IMPORTED_MODULE_3__.useNavigate)();
  const [show, setShow] = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);

  // Merge data
  const data = {
    ...user,
    ...userData
  };

  // Check what's missing
  const getMissingItems = () => {
    const missing = [];
    if ((data === null || data === void 0 ? void 0 : data.kyc_status) !== 'verified') {
      missing.push({
        id: 'kyc',
        label: 'KYC',
        icon: lucide_react__WEBPACK_IMPORTED_MODULE_7__["default"]
      });
    }
    if (!(data !== null && data !== void 0 && data.mobile) || data.mobile.trim() === '') {
      missing.push({
        id: 'mobile',
        label: 'Mobile',
        icon: lucide_react__WEBPACK_IMPORTED_MODULE_6__["default"]
      });
    }
    if (!(data !== null && data !== void 0 && data.name) || data.name.trim() === '') {
      missing.push({
        id: 'name',
        label: 'Name',
        icon: lucide_react__WEBPACK_IMPORTED_MODULE_8__["default"]
      });
    }
    return missing;
  };
  const missingItems = getMissingItems();

  // Don't show if profile is complete
  if (missingItems.length === 0 || !show) return null;
  const handleContinue = () => {
    setShow(false);
    onContinue === null || onContinue === void 0 ? void 0 : onContinue();
  };
  const handleComplete = () => {
    navigate('/profile?edit=true');
    onComplete === null || onComplete === void 0 ? void 0 : onComplete();
  };
  return /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(framer_motion__WEBPACK_IMPORTED_MODULE_2__.motion.div, {
    initial: {
      opacity: 0,
      y: -10
    },
    animate: {
      opacity: 1,
      y: 0
    },
    className: "mb-4",
    children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(_ui_card__WEBPACK_IMPORTED_MODULE_11__.Card, {
      className: "p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30",
      children: /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("div", {
          className: "flex flex-wrap gap-1 flex-1",
          children: missingItems.map(item => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("span", {
            className: "px-2 py-1 bg-gray-800 rounded-lg text-xs flex items-center gap-1",
            children: [/*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(item.icon, {
              className: "w-3 h-3 text-amber-400"
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 310,
              columnNumber: 17
            }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)("span", {
              className: "text-gray-300",
              children: item.label
            }, void 0, false, {
              fileName: _jsxFileName,
              lineNumber: 311,
              columnNumber: 17
            }, undefined)]
          }, item.id, true, {
            fileName: _jsxFileName,
            lineNumber: 306,
            columnNumber: 15
          }, undefined))
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 304,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(_ui_button__WEBPACK_IMPORTED_MODULE_10__.Button, {
          size: "sm",
          onClick: handleComplete,
          className: "h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white",
          children: "Complete"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 316,
          columnNumber: 11
        }, undefined), /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_12__.jsxDEV)(_ui_button__WEBPACK_IMPORTED_MODULE_10__.Button, {
          size: "sm",
          variant: "ghost",
          onClick: handleContinue,
          className: "h-7 text-xs text-gray-400 hover:text-white",
          children: "Skip"
        }, void 0, false, {
          fileName: _jsxFileName,
          lineNumber: 323,
          columnNumber: 11
        }, undefined)]
      }, void 0, true, {
        fileName: _jsxFileName,
        lineNumber: 302,
        columnNumber: 9
      }, undefined)
    }, void 0, false, {
      fileName: _jsxFileName,
      lineNumber: 301,
      columnNumber: 7
    }, undefined)
  }, void 0, false, {
    fileName: _jsxFileName,
    lineNumber: 296,
    columnNumber: 5
  }, undefined);
};
_s3(RedemptionProfilePrompt, "zRyFrqvtBq9C3862gFnXQGDXWbA=", false, function () {
  return [react_router_dom__WEBPACK_IMPORTED_MODULE_3__.useNavigate];
});
_c3 = RedemptionProfilePrompt;
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ProfileCompletionRing);
var _c, _c2, _c3;
__webpack_require__.$Refresh$.register(_c, "ProfileCompletionRing");
__webpack_require__.$Refresh$.register(_c2, "ProfileFloatingReminder");
__webpack_require__.$Refresh$.register(_c3, "RedemptionProfilePrompt");

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

/***/ "./src/components/ui/card.jsx":
/*!************************************!*\
  !*** ./src/components/ui/card.jsx ***!
  \************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Card: () => (/* binding */ Card),
/* harmony export */   CardContent: () => (/* binding */ CardContent),
/* harmony export */   CardDescription: () => (/* binding */ CardDescription),
/* harmony export */   CardFooter: () => (/* binding */ CardFooter),
/* harmony export */   CardHeader: () => (/* binding */ CardHeader),
/* harmony export */   CardTitle: () => (/* binding */ CardTitle)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "./node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _lib_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/lib/utils */ "./src/lib/utils.js");
/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react/jsx-dev-runtime */ "./node_modules/react/jsx-dev-runtime.js");
/* provided dependency */ var __react_refresh_utils__ = __webpack_require__(/*! ./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js */ "./node_modules/@pmmmwh/react-refresh-webpack-plugin/lib/runtime/RefreshUtils.js");
__webpack_require__.$Refresh$.runtime = __webpack_require__(/*! ./node_modules/react-refresh/runtime.js */ "./node_modules/react-refresh/runtime.js");

var _jsxFileName = "/app/frontend/src/components/ui/card.jsx";



const Card = /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0__.forwardRef(_c = ({
  className,
  ...props
}, ref) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxDEV)("div", {
  ref: ref,
  className: (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.cn)("rounded-xl border bg-card text-card-foreground shadow", className),
  ...props
}, void 0, false, {
  fileName: _jsxFileName,
  lineNumber: 6,
  columnNumber: 3
}, undefined));
_c2 = Card;
Card.displayName = "Card";
const CardHeader = /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0__.forwardRef(_c3 = ({
  className,
  ...props
}, ref) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxDEV)("div", {
  ref: ref,
  className: (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.cn)("flex flex-col space-y-1.5 p-6", className),
  ...props
}, void 0, false, {
  fileName: _jsxFileName,
  lineNumber: 14,
  columnNumber: 3
}, undefined));
_c4 = CardHeader;
CardHeader.displayName = "CardHeader";
const CardTitle = /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0__.forwardRef(_c5 = ({
  className,
  ...props
}, ref) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxDEV)("div", {
  ref: ref,
  className: (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.cn)("font-semibold leading-none tracking-tight", className),
  ...props
}, void 0, false, {
  fileName: _jsxFileName,
  lineNumber: 22,
  columnNumber: 3
}, undefined));
_c6 = CardTitle;
CardTitle.displayName = "CardTitle";
const CardDescription = /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0__.forwardRef(_c7 = ({
  className,
  ...props
}, ref) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxDEV)("div", {
  ref: ref,
  className: (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.cn)("text-sm text-muted-foreground", className),
  ...props
}, void 0, false, {
  fileName: _jsxFileName,
  lineNumber: 30,
  columnNumber: 3
}, undefined));
_c8 = CardDescription;
CardDescription.displayName = "CardDescription";
const CardContent = /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0__.forwardRef(_c9 = ({
  className,
  ...props
}, ref) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxDEV)("div", {
  ref: ref,
  className: (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.cn)("p-6 pt-0", className),
  ...props
}, void 0, false, {
  fileName: _jsxFileName,
  lineNumber: 38,
  columnNumber: 3
}, undefined));
_c0 = CardContent;
CardContent.displayName = "CardContent";
const CardFooter = /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0__.forwardRef(_c1 = ({
  className,
  ...props
}, ref) => /*#__PURE__*/(0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxDEV)("div", {
  ref: ref,
  className: (0,_lib_utils__WEBPACK_IMPORTED_MODULE_1__.cn)("flex items-center p-6 pt-0", className),
  ...props
}, void 0, false, {
  fileName: _jsxFileName,
  lineNumber: 43,
  columnNumber: 3
}, undefined));
_c10 = CardFooter;
CardFooter.displayName = "CardFooter";

var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c0, _c1, _c10;
__webpack_require__.$Refresh$.register(_c, "Card$React.forwardRef");
__webpack_require__.$Refresh$.register(_c2, "Card");
__webpack_require__.$Refresh$.register(_c3, "CardHeader$React.forwardRef");
__webpack_require__.$Refresh$.register(_c4, "CardHeader");
__webpack_require__.$Refresh$.register(_c5, "CardTitle$React.forwardRef");
__webpack_require__.$Refresh$.register(_c6, "CardTitle");
__webpack_require__.$Refresh$.register(_c7, "CardDescription$React.forwardRef");
__webpack_require__.$Refresh$.register(_c8, "CardDescription");
__webpack_require__.$Refresh$.register(_c9, "CardContent$React.forwardRef");
__webpack_require__.$Refresh$.register(_c0, "CardContent");
__webpack_require__.$Refresh$.register(_c1, "CardFooter$React.forwardRef");
__webpack_require__.$Refresh$.register(_c10, "CardFooter");

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
//# sourceMappingURL=src_components_ProfileCompletionComponents_jsx.chunk.js.map