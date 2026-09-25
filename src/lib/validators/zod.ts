import { z } from "zod";

/**
 * Zod with translatable error messages. Every message is a key in the "Errors" namespace
 * (translated in the browser by useErrorText), including Zod's built-in errors, so validation
 * errors appear in the visitor's language. Messages set on a schema take precedence.
 * All validators import `z` from here.
 */
z.config({
  customError: (issue) => {
    const input = (issue as { input?: unknown }).input;
    switch (issue.code) {
      case "invalid_type":
        return input === undefined || input === null || input === "" ? "required" : "invalid";
      case "too_small":
        if (issue.origin === "string") return Number(issue.minimum) <= 1 ? "required" : "tooShort";
        if (issue.origin === "array" || issue.origin === "set") return "pickAtLeastOne";
        return "numberOutOfRange";
      case "too_big":
        if (issue.origin === "string") return "tooLong";
        if (issue.origin === "array" || issue.origin === "set") return "tooMany";
        return "numberOutOfRange";
      case "invalid_format":
        if (issue.format === "email") return "emailInvalid";
        if (issue.format === "url") return "urlInvalid";
        if (issue.format === "date" || issue.format === "datetime") return "dateInvalid";
        return "invalid";
      case "invalid_value":
        return "invalidOption";
      case "not_multiple_of":
        return "numberInvalid";
      default:
        return "invalid";
    }
  },
});

export { z };
