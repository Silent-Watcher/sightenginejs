import { collectNumericValues, isNumber } from "../helpers";
import { DEFAULT_THRESHOLDS, type Thresholds } from "../thresholds";
import type {
    ImageModerationResponse,
    NormalizedCategory,
    NormalizedImageModerationResponse,
} from "../types";

function extractNudityBlock(block: any): NormalizedCategory {
    const nums = collectNumericValues(block);
    // find a `none` value if present
    const noneEntry = nums.find((n: any) =>
        n.path.endsWith(".none") || n.path === "none"
    );
    const noneVal = noneEntry ? noneEntry.value : undefined;

    // score from the max of all numeric values excluding 'none'
    const maxOther = nums
        .filter((n: any) => !(n.path.endsWith(".none") || n.path === "none"))
        .reduce((m: any, cur: any) => Math.max(m, cur.value), 0);

    // If provider uses `none` meaning "no nudity", convert to a presence score
    // presenceScore = max(maxOther, 1 - none)
    const presenceFromNone = noneVal !== undefined ? (1 - noneVal) : 0;
    const score = Math.max(maxOther, presenceFromNone);

    // Build subs: show any sub-key with value (use a small cutoff so not to flood)
    const subs = nums
        .filter((n: any) => !(n.path.endsWith(".none") || n.path === "none"))
        .map((n: any) => ({ name: n.path, score: n.value }))
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 30);

    return { name: "nudity", score, subs, raw: block };
}

// Generic block extractor: prefer prob/probability fields, else max numeric leaf
function extractGenericBlock(
    name: string,
    block: any,
): NormalizedCategory {
    if (!block || typeof block !== "object") {
        return { name, score: 0, raw: block };
    }
    const preferKeys = ["prob", "probability", "score", "value"];
    for (const k of preferKeys) {
        if (isNumber(block[k])) {
            // also collect subs if any numeric inside
            const subs = collectNumericValues(block)
                .filter((n) => n.path !== k)
                .map((n) => ({ name: n.path, score: n.value }));
            return {
                name,
                score: block[k],
                subs: subs.length ? subs : undefined,
                raw: block,
            };
        }
    }

    // fallback: max numeric leaf
    const nums = collectNumericValues(block);
    const max = nums.reduce((m, cur) => Math.max(m, cur.value), 0);
    const subs = nums.map((n) => ({ name: n.path, score: n.value }));
    return {
        name,
        score: max,
        subs: subs.length ? subs : undefined,
        raw: block,
    };
}

// Main normalizer: detect known sections, call appropriate extractor
function normalizeResponse(
    apiResp: any,
): NormalizedImageModerationResponse {
    const cats: NormalizedCategory[] = [];
    if (!apiResp || typeof apiResp !== "object") {
        return {
            categories: cats,
            media: apiResp?.media,
            request: apiResp?.request,
        };
    }

    // known keys (adjust as you learn new provider shapes)
    if (apiResp.nudity) cats.push(extractNudityBlock(apiResp.nudity));
    if (apiResp.gore) cats.push(extractGenericBlock("gore", apiResp.gore));
    if (apiResp.violence) {
        cats.push(extractGenericBlock("violence", apiResp.violence));
    }
    if (apiResp["self-harm"] || apiResp.self_harm) {
        const block = apiResp["self-harm"] ?? apiResp.self_harm;
        cats.push(extractGenericBlock("self-harm", block));
    }
    if (apiResp.offensive) {
        cats.push(extractGenericBlock("offensive", apiResp.offensive));
    }
    // add any other top-level numeric blocks (avoid duplicates)
    const known = new Set(cats.map((c) => c.name));
    for (const k of Object.keys(apiResp)) {
        if (known.has(k) || ["media", "request", "status"].includes(k)) {
            continue;
        }
        const v = apiResp[k];
        if (v && typeof v === "object" && collectNumericValues(v).length > 0) {
            cats.push(extractGenericBlock(k, v));
        }
    }
    return { categories: cats, media: apiResp.media, request: apiResp.request };
}

export function listFlaggedCategories(
    imageModerationResponse: ImageModerationResponse,
    thresholds: Thresholds = DEFAULT_THRESHOLDS,
) {
    const normalizedResponse = normalizeResponse(imageModerationResponse);
    return normalizedResponse.categories
        .filter((c) => {
            return (thresholds[c.name] ?? 0.5) < c.score
        })
        .map((c) => ({
            name: c.name,
            score: c.score,
            subs: (c.subs ?? []).filter((s) =>
               (thresholds[c.name] ?? 0.5) < c.score
            ),
        }));
}

export function isNSFW(
    imageModerationResponse: ImageModerationResponse,
    threshold = 0.5,
) {
    const normalizedResponse = normalizeResponse(imageModerationResponse);

    const importantCategories = [
        "nudity",
        "gore",
        "violence",
        "self-harm",
        "sexual",
    ];
    return normalizedResponse.categories.some((c: NormalizedCategory) =>
        importantCategories.includes(c.name) && c.score >= threshold
    );
}
