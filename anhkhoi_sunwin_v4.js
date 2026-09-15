"use strict";

const OMEGA_CONFIG = {
    minHistory: 120,
    maxOrder: 6,
    windows: [8, 12, 16, 20, 30, 50, 80, 120, 250, 500],
    similarityLengths: [5, 6, 7, 8, 10, 12],
    minSupport: 12,
    strongSupport: 30,
    alpha: 1,
    signalThreshold: 0.56,
    strongThreshold: 0.68,
    probabilityFloor: 0.05,
    probabilityCeil: 0.95,
    similarityLimit: 4000,
    ageHalfLife: 300,
    conflictPenalty: 0.65,
    noisyPenalty: 0.55,
    probabilityCompression: 0.82
};

class OmegaMath {

    static clamp(value, min, max) {
        return Math.max(
            min,
            Math.min(max, value)
        );
    }

    static safeNumber(value, fallback = 0) {
        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : fallback;
    }

    static sigmoid(x) {

        if (x >= 0) {
            const z = Math.exp(-x);

            return 1 / (1 + z);
        }

        const z = Math.exp(x);

        return z / (1 + z);
    }

    static logit(p) {

        p = this.clamp(
            p,
            1e-9,
            1 - 1e-9
        );

        return Math.log(
            p / (1 - p)
        );
    }

    static probability(t, x, alpha = 1) {

        const total = t + x;

        if (total <= 0) {
            return 0.5;
        }

        return (
            (t + alpha) /
            (total + alpha * 2)
        );
    }

    static edge(p) {

        return Math.abs(
            p - 0.5
        ) * 2;
    }

    static entropy(p) {

        p = this.clamp(
            p,
            1e-12,
            1 - 1e-12
        );

        return -(
            p * Math.log2(p) +
            (1 - p) * Math.log2(1 - p)
        );
    }

    static direction(p) {
        return p >= 0.5
            ? "T"
            : "X";
    }

    static opposite(side) {
        return side === "T"
            ? "X"
            : "T";
    }

    static weightedAverage(items) {

        let numerator = 0;
        let denominator = 0;

        for (const item of items) {

            if (
                !Number.isFinite(
                    item.value
                )
            ) {
                continue;
            }

            if (
                !Number.isFinite(
                    item.weight
                ) ||
                item.weight <= 0
            ) {
                continue;
            }

            numerator +=
                item.value *
                item.weight;

            denominator +=
                item.weight;
        }

        if (denominator <= 0) {
            return 0.5;
        }

        return numerator / denominator;
    }

    static average(values) {

        if (!values.length) {
            return 0;
        }

        return (
            values.reduce(
                (a, b) => a + b,
                0
            ) /
            values.length
        );
    }

    static variance(values) {

        if (
            values.length < 2
        ) {
            return 0;
        }

        const mean =
            this.average(values);

        return this.average(
            values.map(
                x =>
                    Math.pow(
                        x - mean,
                        2
                    )
            )
        );
    }

    static agreement(probabilities) {

        if (!probabilities.length) {
            return 0;
        }

        let t = 0;
        let x = 0;

        for (const p of probabilities) {

            if (p >= 0.5) {
                t++;
            } else {
                x++;
            }
        }

        return (
            Math.max(t, x) /
            probabilities.length
        );
    }

    static sequenceKey(seq) {
        return seq.join("");
    }
}

class OmegaNormalizer {

    static normalize(records) {

        if (!Array.isArray(records)) {
            throw new TypeError(
                "Input phải là Array."
            );
        }

        const result = [];

        const seen = new Set();

        for (const row of records) {

            if (!row || typeof row !== "object") {
                continue;
            }

            const d1 =
                OmegaMath.safeNumber(
                    row.xuc_xac_1 ??
                    row.dice1 ??
                    row.d1
                );

            const d2 =
                OmegaMath.safeNumber(
                    row.xuc_xac_2 ??
                    row.dice2 ??
                    row.d2
                );

            const d3 =
                OmegaMath.safeNumber(
                    row.xuc_xac_3 ??
                    row.dice3 ??
                    row.d3
                );

            const total =
                OmegaMath.safeNumber(
                    row.tong ??
                    row.total ??
                    d1 + d2 + d3
                );

            const session =
                OmegaMath.safeNumber(
                    row.phien ??
                    row.session ??
                    row.id,
                    NaN
                );

            if (
                ![
                    d1,
                    d2,
                    d3,
                    total
                ].every(
                    Number.isFinite
                )
            ) {
                continue;
            }

            if (
                d1 < 1 ||
                d1 > 6 ||
                d2 < 1 ||
                d2 > 6 ||
                d3 < 1 ||
                d3 > 6
            ) {
                continue;
            }

            

            const rawResult =
                String(
                    row.ket_qua ??
                    row.result ??
                    (
                        total >= 11
                            ? "TAI"
                            : "XIU"
                    )
                )
                    .trim()
                    .toLowerCase();

            const side =
                rawResult.startsWith("t")
                    ? "T"
                    : rawResult.startsWith("x")
                        ? "X"
                        : total >= 11
                            ? "T"
                            : "X";

            

            if (
                Number.isFinite(session)
            ) {

                if (
                    seen.has(session)
                ) {
                    continue;
                }

                seen.add(session);
            }

            result.push({

                phien:
                    Number.isFinite(session)
                        ? session
                        : null,

                d1,
                d2,
                d3,

                total,

                side,

                timestamp:
                    row.created_at ??
                    row.createdAt ??
                    null
            });
        }

        result.sort(
            (a, b) => {

                if (
                    Number.isFinite(
                        a.phien
                    ) &&
                    Number.isFinite(
                        b.phien
                    )
                ) {
                    return (
                        a.phien -
                        b.phien
                    );
                }

                return 0;
            }
        );

        return result;
    }
}

class SequenceEngine {

    constructor(config = OMEGA_CONFIG) {
        this.config = config;
    }

    sides(history) {

        return history.map(
            x => x.side
        );
    }

    encodeRuns(seq) {

        if (!seq.length) {
            return [];
        }

        const runs = [];

        let side = seq[0];
        let length = 1;

        for (
            let i = 1;
            i < seq.length;
            i++
        ) {

            if (
                seq[i] === side
            ) {

                length++;

            } else {

                runs.push({
                    side,
                    length
                });

                side =
                    seq[i];

                length = 1;
            }
        }

        runs.push({
            side,
            length
        });

        return runs;
    }

    runSignature(seq, limit = 12) {

        const runs =
            this.encodeRuns(
                seq
            );

        return runs
            .slice(-limit)
            .map(
                r =>
                    `${r.side}${r.length}`
            )
            .join("-");
    }

    lastRun(seq) {

        const runs =
            this.encodeRuns(
                seq
            );

        return (
            runs.at(-1) ??
            null
        );
    }

    transitionCount(
        seq,
        from,
        to
    ) {

        let count = 0;

        for (
            let i = 1;
            i < seq.length;
            i++
        ) {

            if (
                seq[i - 1] === from &&
                seq[i] === to
            ) {
                count++;
            }
        }

        return count;
    }
}

class PatternEngine {

    constructor(config = OMEGA_CONFIG) {
        this.config = config;
        this.seqEngine =
            new SequenceEngine(
                config
            );
    }

    

    continuationPattern(
        seq,
        pattern
    ) {

        if (
            seq.length <=
            pattern.length
        ) {
            return {
                probability: 0.5,
                support: 0,
                matches: []
            };
        }

        let t = 0;
        let x = 0;

        const matches = [];

        for (
            let i = pattern.length;
            i < seq.length;
            i++
        ) {

            const candidate =
                seq.slice(
                    i - pattern.length,
                    i
                );

            if (
                OmegaMath.sequenceKey(
                    candidate
                ) !==
                OmegaMath.sequenceKey(
                    pattern
                )
            ) {
                continue;
            }

            const actual =
                seq[i];

            if (
                actual === "T"
            ) {
                t++;
            } else {
                x++;
            }

            matches.push({
                index: i,
                actual
            });
        }

        return {
            probability:
                OmegaMath.probability(
                    t,
                    x,
                    this.config.alpha
                ),

            support:
                t + x,

            matches
        };
    }

    

    equalBlockBridge(seq) {

        const runs =
            this.seqEngine.encodeRuns(
                seq
            );

        if (
            runs.length < 2
        ) {
            return {
                name: "EQUAL_BLOCK",
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        const current =
            runs.at(-1);

        const candidates = [];

        for (
            let i = 0;
            i < runs.length - 1;
            i++
        ) {

            const r =
                runs[i];

            if (
                r.length ===
                current.length
            ) {

                candidates.push(
                    runs[i + 1]?.side
                );
            }
        }

        const valid =
            candidates.filter(
                Boolean
            );

        let t = 0;
        let x = 0;

        for (
            const side of valid
        ) {

            if (side === "T") {
                t++;
            } else {
                x++;
            }
        }

        const p =
            OmegaMath.probability(
                t,
                x,
                this.config.alpha
            );

        return {

            name:
                `EQUAL_BLOCK_${current.length}`,

            probability: p,

            strength:
                valid.length >=
                this.config.minSupport
                    ? OmegaMath.edge(p)
                    : 0,

            support:
                valid.length,

            currentRun:
                current.length,

            currentSide:
                current.side
        };
    }

    

    alternating(seq, window) {

        const data =
            seq.slice(-window);

        if (
            data.length < 4
        ) {
            return {
                name: `ALT_${window}`,
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        let alternations = 0;

        for (
            let i = 1;
            i < data.length;
            i++
        ) {

            if (
                data[i] !==
                data[i - 1]
            ) {
                alternations++;
            }
        }

        const ratio =
            alternations /
            (data.length - 1);

        const last =
            data.at(-1);

        const predicted =
            OmegaMath.opposite(
                last
            );

        

        const edge =
            ratio *
            0.42;

        const p =
            predicted === "T"
                ? 0.5 + edge
                : 0.5 - edge;

        return {

            name:
                `ALT_${window}`,

            probability:
                OmegaMath.clamp(
                    p,
                    0.05,
                    0.95
                ),

            strength:
                ratio *
                0.90,

            support:
                data.length - 1,

            ratio,

            predicted
        };
    }

    

    blockPattern(
        seq,
        blockSize
    ) {

        const runs =
            this.seqEngine.encodeRuns(
                seq
            );

        if (
            runs.length < 4
        ) {
            return {
                name:
                    `BLOCK_${blockSize}`,
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        const valid =
            runs.filter(
                r =>
                    r.length ===
                    blockSize
            );

        if (
            valid.length < 3
        ) {
            return {
                name:
                    `BLOCK_${blockSize}`,
                probability: 0.5,
                strength: 0,
                support:
                    valid.length
            };
        }

        let t = 0;
        let x = 0;

        

        for (
            let i = 0;
            i < runs.length - 1;
            i++
        ) {

            if (
                runs[i].length !==
                blockSize
            ) {
                continue;
            }

            const next =
                runs[i + 1];

            if (
                next.side === "T"
            ) {
                t++;
            } else {
                x++;
            }
        }

        const p =
            OmegaMath.probability(
                t,
                x,
                this.config.alpha
            );

        return {

            name:
                `BLOCK_${blockSize}`,

            probability: p,

            strength:
                t + x >=
                this.config.minSupport
                    ? OmegaMath.edge(p)
                    : 0,

            support:
                t + x,

            blockSize
        };
    }

    

    runContinuation(
        seq
    ) {

        const runs =
            this.seqEngine.encodeRuns(
                seq
            );

        const current =
            runs.at(-1);

        if (!current) {
            return {
                name: "RUN_CONTINUATION",
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        

        let continueCount = 0;
        let reverseCount = 0;

        for (
            let i = 0;
            i < runs.length - 1;
            i++
        ) {

            const r = runs[i];

            if (
                r.side !==
                current.side ||
                r.length !==
                current.length
            ) {
                continue;
            }

            const next =
                runs[i + 1];

            if (
                next.side ===
                current.side
            ) {
                continueCount++;
            } else {
                reverseCount++;
            }
        }

        

        let t = 0;
        let x = 0;

        

        for (
            let i = 0;
            i < runs.length - 1;
            i++
        ) {

            const r = runs[i];

            if (
                r.side === current.side &&
                r.length === current.length
            ) {

                const next =
                    runs[i + 1];

                if (
                    next.side === "T"
                ) {
                    t++;
                } else {
                    x++;
                }
            }
        }

        const support =
            t + x;

        const p =
            OmegaMath.probability(
                t,
                x,
                this.config.alpha
            );

        return {

            name:
                "RUN_CONTINUATION",

            probability: p,

            strength:
                support >=
                this.config.minSupport
                    ? OmegaMath.edge(p)
                    : 0,

            support,

            currentRun:
                current.length,

            currentSide:
                current.side
        };
    }

    

    runShapeBridge(seq) {

        const runs =
            this.seqEngine.encodeRuns(
                seq
            );

        const shapes = [
            [1, 2, 1],
            [2, 1, 2],
            [1, 2, 2, 1],
            [2, 1, 1, 2],
            [1, 3, 1],
            [3, 1, 3],
            [2, 2, 1, 2],
            [2, 1, 2, 2]
        ];

        const signals = [];

        for (
            const shape of shapes
        ) {

            if (
                runs.length <
                shape.length
            ) {
                continue;
            }

            const current =
                runs.slice(
                    -shape.length
                );

            const currentShape =
                current.map(
                    r =>
                        r.length
                );

            if (
                OmegaMath.sequenceKey(
                    currentShape
                ) ===
                OmegaMath.sequenceKey(
                    shape
                )
            ) {
                signals.push(
                    this.findShapeContinuation(
                        runs,
                        shape
                    )
                );
            }
        }

        if (!signals.length) {
            return {
                name: "RUN_SHAPE",
                probability: 0.5,
                strength: 0,
                support: 0,
                detected: []
            };
        }

        const usable =
            signals.filter(
                s =>
                    s.support > 0
            );

        const p =
            OmegaMath.weightedAverage(
                usable.map(
                    s => ({
                        value:
                            s.probability,
                        weight:
                            Math.log1p(
                                s.support
                            )
                    })
                )
            );

        return {

            name:
                "RUN_SHAPE",

            probability: p,

            strength:
                OmegaMath.edge(p),

            support:
                usable.reduce(
                    (sum, s) =>
                        sum + s.support,
                    0
                ),

            detected:
                usable
        };
    }

    findShapeContinuation(
        runs,
        shape
    ) {

        let t = 0;
        let x = 0;

        for (
            let i = shape.length;
            i < runs.length;
            i++
        ) {

            const candidate =
                runs
                    .slice(
                        i - shape.length,
                        i
                    )
                    .map(
                        r =>
                            r.length
                    );

            if (
                OmegaMath.sequenceKey(
                    candidate
                ) !==
                OmegaMath.sequenceKey(
                    shape
                )
            ) {
                continue;
            }

            const actual =
                runs[i].side;

            if (
                actual === "T"
            ) {
                t++;
            } else {
                x++;
            }
        }

        const p =
            OmegaMath.probability(
                t,
                x,
                this.config.alpha
            );

        return {

            shape,

            probability: p,

            support:
                t + x,

            strength:
                OmegaMath.edge(p)
        };
    }

    

    staircase(seq) {

        const runs =
            this.seqEngine.encodeRuns(
                seq
            );

        if (
            runs.length < 3
        ) {
            return {
                name: "STAIRCASE",
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        const recent =
            runs.slice(-5);

        const lengths =
            recent.map(
                r => r.length
            );

        let increasing = 0;
        let decreasing = 0;

        for (
            let i = 1;
            i < lengths.length;
            i++
        ) {

            if (
                lengths[i] >
                lengths[i - 1]
            ) {
                increasing++;
            }

            if (
                lengths[i] <
                lengths[i - 1]
            ) {
                decreasing++;
            }
        }

        const comparisons =
            Math.max(
                1,
                lengths.length - 1
            );

        const incRatio =
            increasing /
            comparisons;

        const decRatio =
            decreasing /
            comparisons;

        const last =
            recent.at(-1);

        let p = 0.5;

        

        if (
            incRatio >= 0.75
        ) {

            p =
                last.side === "T"
                    ? 0.54
                    : 0.46;

        } else if (
            decRatio >= 0.75
        ) {

            p =
                last.side === "T"
                    ? 0.46
                    : 0.54;
        }

        return {

            name:
                "STAIRCASE",

            probability: p,

            strength:
                Math.max(
                    incRatio,
                    decRatio
                ) *
                0.25,

            support:
                comparisons,

            increasing:
                incRatio,

            decreasing:
                decRatio
        };
    }

    

    mirror(seq) {

        const L = 4;

        if (
            seq.length <
            L * 2
        ) {
            return {
                name: "MIRROR",
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        const left =
            seq.slice(
                -L * 2,
                -L
            );

        const right =
            seq.slice(-L);

        let matches = 0;

        for (
            let i = 0;
            i < L;
            i++
        ) {

            if (
                right[i] ===
                left[L - 1 - i]
            ) {
                matches++;
            }
        }

        const ratio =
            matches / L;

        if (
            ratio < 0.75
        ) {
            return {
                name: "MIRROR",
                probability: 0.5,
                strength: 0,
                support: L,
                ratio
            };
        }

        

        const predicted =
            left[0];

        const p =
            predicted === "T"
                ? 0.5 +
                  ratio * 0.18
                : 0.5 -
                  ratio * 0.18;

        return {

            name: "MIRROR",

            probability:
                OmegaMath.clamp(
                    p,
                    0.05,
                    0.95
                ),

            strength:
                ratio * 0.25,

            support: L,

            ratio,

            predicted
        };
    }

    

    cycle(seq) {

        let best = null;

        const maxPeriod =
            Math.min(
                16,
                Math.floor(
                    seq.length / 4
                )
            );

        for (
            let period = 2;
            period <= maxPeriod;
            period++
        ) {

            let same = 0;
            let total = 0;

            for (
                let i = period;
                i < seq.length;
                i++
            ) {

                total++;

                if (
                    seq[i] ===
                    seq[i - period]
                ) {
                    same++;
                }
            }

            if (
                total <= 0
            ) {
                continue;
            }

            const ratio =
                same / total;

            if (
                !best ||
                ratio >
                    best.ratio
            ) {

                best = {
                    period,
                    ratio,
                    support: total
                };
            }
        }

        if (
            !best ||
            best.ratio < 0.65
        ) {
            return {
                name: "CYCLE",
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        const predicted =
            seq[
                seq.length -
                best.period
            ];

        const p =
            predicted === "T"
                ? 0.5 +
                  (best.ratio - 0.5)
                    * 0.45
                : 0.5 -
                  (best.ratio - 0.5)
                    * 0.45;

        return {

            name: "CYCLE",

            probability:
                OmegaMath.clamp(
                    p,
                    0.05,
                    0.95
                ),

            strength:
                (best.ratio - 0.5) *
                1.4,

            support:
                best.support,

            period:
                best.period,

            ratio:
                best.ratio,

            predicted
        };
    }
}

class MarkovEngine {

    constructor(config = OMEGA_CONFIG) {
        this.config = config;
    }

    analyze(
        seq,
        order
    ) {

        if (
            seq.length <=
            order
        ) {
            return {
                name:
                    `MARKOV_${order}`,
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        const context =
            seq.slice(-order);

        let t = 0;
        let x = 0;

        for (
            let i = order;
            i < seq.length;
            i++
        ) {

            const previous =
                seq.slice(
                    i - order,
                    i
                );

            if (
                OmegaMath.sequenceKey(
                    previous
                ) !==
                OmegaMath.sequenceKey(
                    context
                )
            ) {
                continue;
            }

            if (
                seq[i] === "T"
            ) {
                t++;
            } else {
                x++;
            }
        }

        const support =
            t + x;

        const p =
            OmegaMath.probability(
                t,
                x,
                this.config.alpha
            );

        const usable =
            support >=
            this.config.minSupport;

        return {

            name:
                `MARKOV_${order}`,

            probability:
                usable
                    ? p
                    : 0.5,

            strength:
                usable
                    ? OmegaMath.edge(p)
                    : 0,

            support,

            context:
                context.join(""),

            usable
        };
    }
}

class SimilarityEngine {

    constructor(config = OMEGA_CONFIG) {
        this.config = config;
    }

    distance(a, b) {

        let d = 0;

        for (
            let i = 0;
            i < a.length;
            i++
        ) {

            if (
                a[i] !== b[i]
            ) {
                d++;
            }
        }

        return d;
    }

    analyze(
        seq,
        length
    ) {

        if (
            seq.length <= length + 1
        ) {
            return {
                name:
                    `SIM_${length}`,
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        const target =
            seq.slice(-length);

        const start =
            Math.max(
                length,
                seq.length -
                    this.config
                        .similarityLimit
            );

        let weightedT = 0;
        let weightedX = 0;

        let matches = 0;

        for (
            let i = start;
            i < seq.length;
            i++
        ) {

            

            const candidate =
                seq.slice(
                    i - length,
                    i
                );

            if (
                candidate.length !==
                length
            ) {
                continue;
            }

            const actual =
                seq[i];

            const d =
                this.distance(
                    target,
                    candidate
                );

            

            const weight =
                Math.exp(
                    -0.70 * d
                );

            if (
                weight < 0.015
            ) {
                continue;
            }

            if (
                actual === "T"
            ) {
                weightedT +=
                    weight;
            } else {
                weightedX +=
                    weight;
            }

            matches++;
        }

        const total =
            weightedT +
            weightedX;

        if (
            total <= 0
        ) {
            return {
                name:
                    `SIM_${length}`,
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        const p =
            weightedT /
            total;

        return {

            name:
                `SIM_${length}`,

            probability:
                OmegaMath.clamp(
                    p,
                    0.05,
                    0.95
                ),

            strength:
                OmegaMath.edge(p),

            support:
                matches,

            weightedSupport:
                total,

            exactLength:
                length
        };
    }
}

class RecencyEngine {

    constructor(config = OMEGA_CONFIG) {
        this.config = config;
    }

    analyze(seq) {

        const windows = [];

        for (
            const size of
            this.config.windows
        ) {

            if (
                seq.length <
                size
            ) {
                continue;
            }

            const data =
                seq.slice(-size);

            const t =
                data.filter(
                    x => x === "T"
                ).length;

            const p =
                OmegaMath.probability(
                    t,
                    size - t,
                    this.config.alpha
                );

            

            const weight =
                1 /
                Math.sqrt(size);

            windows.push({

                size,

                probability: p,

                support: size,

                weight,

                strength:
                    OmegaMath.edge(p)
            });
        }

        if (!windows.length) {
            return {
                name: "RECENCY",
                probability: 0.5,
                strength: 0,
                support: 0,
                windows: []
            };
        }

        const p =
            OmegaMath.weightedAverage(
                windows.map(
                    w => ({
                        value:
                            w.probability,
                        weight:
                            w.weight
                    })
                )
            );

        return {

            name: "RECENCY",

            probability: p,

            strength:
                OmegaMath.edge(p),

            support:
                windows.reduce(
                    (sum, w) =>
                        sum + w.support,
                    0
                ),

            windows
        };
    }
}

class MomentumEngine {

    analyze(seq) {

        if (
            seq.length < 30
        ) {
            return {
                name: "MOMENTUM",
                probability: 0.5,
                strength: 0,
                support: 0
            };
        }

        const short =
            seq.slice(-10);

        const medium =
            seq.slice(-30);

        const long =
            seq.slice(-100);

        const ratio =
            arr =>
                arr.filter(
                    x => x === "T"
                ).length /
                arr.length;

        const pShort =
            ratio(short);

        const pMedium =
            ratio(medium);

        const pLong =
            ratio(long);

        

        const delta =
            (
                pShort * 0.55 +
                pMedium * 0.30 +
                pLong * 0.15
            ) -
            0.5;

        const p =
            OmegaMath.clamp(
                0.5 +
                    delta * 0.75,
                0.05,
                0.95
            );

        return {

            name:
                "MOMENTUM",

            probability: p,

            strength:
                Math.abs(delta) *
                1.5,

            support:
                short.length +
                medium.length +
                long.length,

            short:
                pShort,

            medium:
                pMedium,

            long:
                pLong
        };
    }
}

class TransitionEngine {

    analyze(seq) {

        let TT = 0;
        let TX = 0;
        let XT = 0;
        let XX = 0;

        for (
            let i = 1;
            i < seq.length;
            i++
        ) {

            const a =
                seq[i - 1];

            const b =
                seq[i];

            if (
                a === "T" &&
                b === "T"
            ) {
                TT++;
            }

            if (
                a === "T" &&
                b === "X"
            ) {
                TX++;
            }

            if (
                a === "X" &&
                b === "T"
            ) {
                XT++;
            }

            if (
                a === "X" &&
                b === "X"
            ) {
                XX++;
            }
        }

        const current =
            seq.at(-1);

        let p;

        let support;

        if (
            current === "T"
        ) {

            p =
                OmegaMath.probability(
                    TT,
                    TX
                );

            support =
                TT + TX;

        } else {

            p =
                OmegaMath.probability(
                    XT,
                    XX
                );

            support =
                XT + XX;
        }

        return {

            name:
                "TRANSITION",

            probability: p,

            strength:
                OmegaMath.edge(p),

            support,

            matrix: {
                TT,
                TX,
                XT,
                XX
            }
        };
    }
}

class RegimeEngine {

    constructor(config = OMEGA_CONFIG) {
        this.config = config;

        this.seqEngine =
            new SequenceEngine(
                config
            );
    }

    analyze(seq) {

        const data =
            seq.slice(-60);

        if (
            data.length < 20
        ) {
            return {
                type: "UNKNOWN",
                confidence: 0
            };
        }

        const runs =
            this.seqEngine.encodeRuns(
                data
            );

        const avgRun =
            OmegaMath.average(
                runs.map(
                    r => r.length
                )
            );

        let transitions = 0;

        for (
            let i = 1;
            i < data.length;
            i++
        ) {

            if (
                data[i] !==
                data[i - 1]
            ) {
                transitions++;
            }
        }

        const alternation =
            transitions /
            (data.length - 1);

        const t =
            data.filter(
                x => x === "T"
            ).length;

        const bias =
            Math.abs(
                t / data.length -
                0.5
            );

        let type =
            "BALANCED";

        if (
            alternation >= 0.82
        ) {

            type =
                "STRONG_ALTERNATING";

        } else if (
            alternation >= 0.70
        ) {

            type =
                "ALTERNATING";

        } else if (
            avgRun >= 4
        ) {

            type =
                "LONG_RUN";

        } else if (
            avgRun >= 2.2
        ) {

            type =
                "SHORT_RUN";
        }

        

        const H =
            OmegaMath.entropy(
                t / data.length
            );

        if (
            H >= 0.995 &&
            alternation > 0.42 &&
            alternation < 0.62
        ) {
            type = "NOISY";
        }

        const confidence =
            OmegaMath.clamp(
                Math.max(
                    alternation,
                    1 - alternation,
                    bias * 2
                ),
                0,
                1
            );

        return {

            type,

            confidence,

            averageRun:
                avgRun,

            alternation,

            bias,

            entropy:
                H,

            sample:
                data.length
        };
    }
}

class EntropyEngine {

    analyze(seq) {

        const windows = [
            20,
            50,
            100
        ];

        const result = [];

        for (
            const size of windows
        ) {

            if (
                seq.length <
                size
            ) {
                continue;
            }

            const data =
                seq.slice(-size);

            const p =
                data.filter(
                    x => x === "T"
                ).length /
                data.length;

            const H =
                OmegaMath.entropy(
                    p
                );

            result.push({

                window: size,

                probability: p,

                entropy: H,

                predictability:
                    1 - H
            });
        }

        if (!result.length) {
            return {
                entropy: 1,
                predictability: 0,
                windows: []
            };
        }

        return {

            entropy:
                OmegaMath.average(
                    result.map(
                        x =>
                            x.entropy
                    )
                ),

            predictability:
                OmegaMath.average(
                    result.map(
                        x =>
                            x.predictability
                    )
                ),

            windows: result
        };
    }
}

class BridgeFusion {

    constructor(
        config = OMEGA_CONFIG
    ) {

        this.config = config;

        this.pattern =
            new PatternEngine(
                config
            );

        this.markov =
            new MarkovEngine(
                config
            );

        this.similarity =
            new SimilarityEngine(
                config
            );

        this.recency =
            new RecencyEngine(
                config
            );

        this.momentum =
            new MomentumEngine();

        this.transition =
            new TransitionEngine();

        this.regime =
            new RegimeEngine(
                config
            );

        this.entropy =
            new EntropyEngine();
    }

    collect(history) {

        const seq =
            history.map(
                x => x.side
            );

        const signals = [];

        const add = (
            signal,
            baseWeight,
            category
        ) => {

            if (!signal) {
                return;
            }

            const support =
                Number(
                    signal.support ?? 0
                );

            

            const supportFactor =
                OmegaMath.clamp(
                    Math.log1p(
                        support
                    ) /
                    Math.log1p(
                        this.config
                            .strongSupport
                    ),
                    0,
                    1
                );

            const strength =
                OmegaMath.clamp(
                    Number(
                        signal.strength ??
                        0
                    ),
                    0,
                    1
                );

            const evidence =
                0.25 +
                0.45 *
                    supportFactor +
                0.30 *
                    strength;

            signals.push({

                ...signal,

                category,

                baseWeight,

                evidence,

                effectiveWeight:
                    baseWeight *
                    evidence
            });
        };

        

        add(
            this.pattern.equalBlockBridge(
                seq
            ),
            1.15,
            "BET"
        );

        

        for (
            const window of
            [12, 20, 30, 50]
        ) {

            add(
                this.pattern.alternating(
                    seq,
                    window
                ),
                0.90,
                "ALTERNATION"
            );
        }

        

        for (
            const blockSize of
            [2, 3, 4, 5]
        ) {

            add(
                this.pattern.blockPattern(
                    seq,
                    blockSize
                ),
                0.82,
                "BLOCK"
            );
        }

        

        add(
            this.pattern.runShapeBridge(
                seq
            ),
            1.00,
            "RUN_SHAPE"
        );

        

        add(
            this.pattern.staircase(
                seq
            ),
            0.55,
            "STAIRCASE"
        );

        

        add(
            this.pattern.mirror(
                seq
            ),
            0.45,
            "MIRROR"
        );

        

        add(
            this.pattern.cycle(
                seq
            ),
            0.65,
            "CYCLE"
        );

        

        add(
            this.pattern.runContinuation(
                seq
            ),
            0.90,
            "RUN"
        );

        

        for (
            let order = 1;
            order <=
            this.config.maxOrder;
            order++
        ) {

            add(
                this.markov.analyze(
                    seq,
                    order
                ),

                

                1.00 -
                (order - 1) *
                0.09,

                "MARKOV"
            );
        }

        

        for (
            const length of
            this.config
                .similarityLengths
        ) {

            add(
                this.similarity.analyze(
                    seq,
                    length
                ),

                0.95,

                "SIMILARITY"
            );
        }

        

        add(
            this.recency.analyze(
                seq
            ),
            0.65,
            "RECENCY"
        );

        

        add(
            this.momentum.analyze(
                seq
            ),
            0.48,
            "MOMENTUM"
        );

        

        add(
            this.transition.analyze(
                seq
            ),
            0.70,
            "TRANSITION"
        );

        const regime =
            this.regime.analyze(
                seq
            );

        const entropy =
            this.entropy.analyze(
                seq
            );

        return {
            signals,
            regime,
            entropy
        };
    }

    fuse(
        signals,
        regime,
        entropy
    ) {

        if (!signals.length) {

            return {
                probability: 0.5,
                confidence: 0,
                agreement: 0,
                conflict: 1
            };
        }

        

        let sum = 0;
        let weight = 0;

        for (
            const signal of signals
        ) {

            let w =
                signal.effectiveWeight;

            

            const edge =
                OmegaMath.edge(
                    signal.probability
                );

            w *=
                0.45 +
                0.55 *
                    edge;

            sum +=
                signal.probability *
                w;

            weight += w;
        }

        let p =
            weight > 0
                ? sum / weight
                : 0.5;

        

        const valid =
            signals.filter(
                s =>
                    s.effectiveWeight >
                    0
            );

        let taiWeight = 0;
        let xiuWeight = 0;

        for (
            const s of valid
        ) {

            if (
                s.probability >=
                0.5
            ) {

                taiWeight +=
                    s.effectiveWeight;

            } else {

                xiuWeight +=
                    s.effectiveWeight;
            }
        }

        const totalDirectional =
            taiWeight +
            xiuWeight;

        const agreement =
            totalDirectional > 0
                ? Math.max(
                      taiWeight,
                      xiuWeight
                  ) /
                  totalDirectional
                : 0;

        const conflict =
            1 - agreement;

        

        let regimeFactor = 1;

        switch (
            regime.type
        ) {

            case "STRONG_ALTERNATING":
                regimeFactor = 0.94;
                break;

            case "ALTERNATING":
                regimeFactor = 0.90;
                break;

            case "LONG_RUN":
                regimeFactor = 0.88;
                break;

            case "SHORT_RUN":
                regimeFactor = 0.82;
                break;

            case "NOISY":
                regimeFactor =
                    this.config
                        .noisyPenalty;
                break;

            default:
                regimeFactor = 0.75;
        }

        

        p =
            0.5 +
            (p - 0.5) *
            regimeFactor *
            this.config
                .probabilityCompression;

        

        const entropyFactor =
            OmegaMath.clamp(
                entropy.predictability *
                    0.75 +
                    0.25,
                0.25,
                1
            );

        

        const edge =
            OmegaMath.edge(p);

        let confidence =
            edge *
            (
                0.42 +
                0.38 *
                    agreement +
                0.20 *
                    entropyFactor
            );

        

        confidence *=
            1 -
            conflict *
                this.config
                    .conflictPenalty;

        confidence =
            OmegaMath.clamp(
                confidence,
                0,
                1
            );

        

        let status =
            "NO_SIGNAL";

        if (
            confidence >=
            this.config
                .strongThreshold
        ) {

            status =
                "STRONG_SIGNAL";

        } else if (
            confidence >=
            this.config
                .signalThreshold
        ) {

            status =
                "SIGNAL";
        }

        return {

            probability:
                OmegaMath.clamp(
                    p,
                    this.config
                        .probabilityFloor,
                    this.config
                        .probabilityCeil
                ),

            taiProbability:
                OmegaMath.clamp(
                    p,
                    0,
                    1
                ),

            xiuProbability:
                1 -
                OmegaMath.clamp(
                    p,
                    0,
                    1
                ),

            direction:
                OmegaMath.direction(p),

            confidence,

            agreement,

            conflict,

            status,

            regimeFactor,

            entropyFactor
        };
    }
}

class OmegaBridgeModel {

    constructor(
        config = OMEGA_CONFIG
    ) {

        this.config = config;

        this.fusion =
            new BridgeFusion(
                config
            );
    }

    predict(records) {

        const history =
            OmegaNormalizer.normalize(
                records
            );

        if (
            history.length <
            this.config.minHistory
        ) {

            return {

                status:
                    "INSUFFICIENT_DATA",

                prediction:
                    null,

                probability:
                    0.5,

                confidence:
                    0,

                historySize:
                    history.length
            };
        }

        const collected =
            this.fusion.collect(
                history
            );

        const fused =
            this.fusion.fuse(
                collected.signals,
                collected.regime,
                collected.entropy
            );

        

        const groups = {};

        for (
            const signal of
            collected.signals
        ) {

            if (
                !groups[
                    signal.category
                ]
            ) {

                groups[
                    signal.category
                ] = [];
            }

            groups[
                signal.category
            ].push(
                signal
            );
        }

        

        const rankedSignals =
            [...collected.signals]
                .sort(
                    (a, b) =>
                        (
                            b.effectiveWeight *
                            b.strength
                        ) -
                        (
                            a.effectiveWeight *
                            a.strength
                        )
                );

        return {

            status:
                fused.status,

            prediction:
                fused.status ===
                "NO_SIGNAL"
                    ? null
                    : fused.direction,

            probability:
                fused.probability,

            taiProbability:
                fused.taiProbability,

            xiuProbability:
                fused.xiuProbability,

            confidence:
                fused.confidence,

            agreement:
                fused.agreement,

            conflict:
                fused.conflict,

            historySize:
                history.length,

            latestSession:
                history.at(-1)
                    ?.phien ??
                null,

            latestOutcome:
                history.at(-1)
                    ?.side ??
                null,

            regime:
                collected.regime,

            entropy:
                collected.entropy,

            strongestSignals:
                rankedSignals
                    .slice(0, 15)
                    .map(
                        s => ({
                            name:
                                s.name,

                            category:
                                s.category,

                            direction:
                                OmegaMath
                                    .direction(
                                        s.probability
                                    ),

                            probability:
                                s.probability,

                            strength:
                                s.strength,

                            support:
                                s.support,

                            effectiveWeight:
                                s.effectiveWeight
                        })
                    ),

            groups
        };
    }
}

class OmegaBacktester {

    constructor(
        config = OMEGA_CONFIG
    ) {

        this.config = config;

        this.model =
            new OmegaBridgeModel(
                config
            );
    }

    run(
        records,
        options = {}
    ) {

        const history =
            OmegaNormalizer.normalize(
                records
            );

        const warmup =
            options.warmup ??
            Math.max(
                500,
                this.config
                    .minHistory
            );

        const maxSamples =
            options.maxSamples ??
            Infinity;

        if (
            history.length <=
            warmup
        ) {

            return {

                status:
                    "INSUFFICIENT_DATA",

                total:
                    0
            };
        }

        const results = [];

        let correct = 0;
        let predicted = 0;

        let brier = 0;
        let logLoss = 0;

        

        const signalStats = {};

        const end =
            Math.min(
                history.length,
                warmup +
                    maxSamples
            );

        for (
            let i = warmup;
            i < end;
            i++
        ) {

            

            const train =
                history.slice(
                    0,
                    i
                );

            const actual =
                history[i].side;

            const actualValue =
                actual === "T"
                    ? 1
                    : 0;

            const prediction =
                this.model.predict(
                    train
                );

            const p =
                OmegaMath.clamp(
                    prediction
                        .probability,
                    0.001,
                    0.999
                );

            

            brier +=
                Math.pow(
                    p -
                    actualValue,
                    2
                );

            

            logLoss +=
                actualValue === 1
                    ? -Math.log(p)
                    : -Math.log(
                          1 - p
                      );

            

            if (
                prediction.status !==
                "NO_SIGNAL"
            ) {

                predicted++;

                if (
                    prediction.prediction ===
                    actual
                ) {

                    correct++;
                }
            }

            

            for (
                const signal of
                prediction
                    .strongestSignals
            ) {

                if (
                    !signalStats[
                        signal.name
                    ]
                ) {

                    signalStats[
                        signal.name
                    ] = {

                        total: 0,

                        correct: 0,

                        probabilitySum:
                            0
                    };
                }

                const stat =
                    signalStats[
                        signal.name
                    ];

                stat.total++;

                stat.probabilitySum +=
                    signal.probability;

                if (
                    signal.direction ===
                    actual
                ) {

                    stat.correct++;
                }
            }

            results.push({

                phien:
                    history[i].phien,

                actual,

                prediction:
                    prediction.prediction,

                probability:
                    prediction.probability,

                confidence:
                    prediction.confidence,

                status:
                    prediction.status,

                regime:
                    prediction
                        .regime
                        .type
            });
        }

        const total =
            results.length;

        const accuracy =
            predicted > 0
                ? correct /
                  predicted
                : null;

        const coverage =
            total > 0
                ? predicted /
                  total
                : 0;

        const signalPerformance = {};

        for (
            const [
                name,
                stat
            ]
            of Object.entries(
                signalStats
            )
        ) {

            signalPerformance[
                name
            ] = {

                total:
                    stat.total,

                accuracy:
                    stat.total > 0
                        ? stat.correct /
                          stat.total
                        : null,

                averageProbability:
                    stat.total > 0
                        ? stat.probabilitySum /
                          stat.total
                        : null
            };
        }

        

        const calibration =
            this.buildCalibration(
                results
            );

        return {

            status:
                "COMPLETE",

            warmup,

            total,

            predicted,

            correct,

            accuracy,

            coverage,

            brierScore:
                total > 0
                    ? brier / total
                    : null,

            logLoss:
                total > 0
                    ? logLoss / total
                    : null,

            calibration,

            signalPerformance,

            results
        };
    }

    buildCalibration(results) {

        const buckets = [];

        for (
            let start = 0.50;
            start < 1.00;
            start += 0.05
        ) {

            const end =
                start + 0.05;

            const selected =
                results.filter(
                    r => {

                        const confidence =
                            r.confidence;

                        return (
                            confidence >=
                            start &&
                            confidence <
                            end
                        );
                    }
                );

            if (
                !selected.length
            ) {

                buckets.push({

                    range:
                        `${start.toFixed(
                            2
                        )}-${end.toFixed(
                            2
                        )}`,

                    samples: 0,

                    accuracy:
                        null
                });

                continue;
            }

            const valid =
                selected.filter(
                    r =>
                        r.prediction
                );

            const hits =
                valid.filter(
                    r =>
                        r.prediction ===
                        r.actual
                ).length;

            buckets.push({

                range:
                    `${start.toFixed(
                        2
                    )}-${end.toFixed(
                        2
                    )}`,

                samples:
                    valid.length,

                accuracy:
                    valid.length
                        ? hits /
                          valid.length
                        : null
            });
        }

        return buckets;
    }
}

const fs = require("fs");
const path = require("path");

const API_URL = "https://sunwin-taixiu-dulieu.onrender.com/data";
const DATA_FILE = "collected_data/sunwin_tx.json";
const STATS_FILE = "database/stats.json";
const POLL_INTERVAL_MS = 1000;
const REQUEST_TIMEOUT_MS = 20000;

const vnNow = () => new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false
}).replace(" ", "T") + "+07:00";

let stats = {
    total: 0,
    correct: 0,
    wrong: 0,
    last_prediction: null,
    start_time: vnNow(),
    history: [],
    total_predictions_made: 0
};

const predictor = new OmegaBridgeModel(OMEGA_CONFIG);

function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function firstValue(obj, keys) {
    for (const key of keys) {
        if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
            return obj[key];
        }
    }
    return null;
}

function normalizeOutcome(value, total) {
    const raw = String(value ?? "").trim().toLowerCase();
    if (/^(t|tai|tai|big|over|taixiu_tai)/u.test(raw)) return "TAI";
    if (/^(x|xiu|xiu|small|under|taixiu_xiu)/u.test(raw)) return "XIU";
    return total >= 11 ? "TAI" : "XIU";
}

function unwrapRecords(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];

    const directKeys = [
        "data", "history", "results", "records", "items", "sessions",
        "rounds", "list", "rows", "games", "lich_su", "du_lieu"
    ];

    for (const key of directKeys) {
        if (Array.isArray(payload[key])) return payload[key];
    }

    for (const key of directKeys) {
        if (payload[key] && typeof payload[key] === "object") {
            const nested = unwrapRecords(payload[key]);
            if (nested.length) return nested;
        }
    }

    return [];
}

function parseApiRecords(payload) {
    const rows = unwrapRecords(payload);
    const map = new Map();

    for (const item of rows) {
        if (!item || typeof item !== "object") continue;

        const phien = number(firstValue(item, [
            "Phien", "phien", "phien", "session", "session_id", "sessionId",
            "round", "round_id", "roundId", "game_id", "gameId", "id"
        ]));

        const d1 = number(firstValue(item, [
            "Xuc_xac_1", "xuc_xac_1", "xuc_xac_1", "dice1", "dice_1", "d1", "x1"
        ]));
        const d2 = number(firstValue(item, [
            "Xuc_xac_2", "xuc_xac_2", "xuc_xac_2", "dice2", "dice_2", "d2", "x2"
        ]));
        const d3 = number(firstValue(item, [
            "Xuc_xac_3", "xuc_xac_3", "xuc_xac_3", "dice3", "dice_3", "d3", "x3"
        ]));

        const diceArray = firstValue(item, ["dice", "dices", "xuc_xac", "xuc_xac"]);
        const dice = Array.isArray(diceArray) ? diceArray.map(number) : [];
        const a = d1 ?? dice[0];
        const b = d2 ?? dice[1];
        const c = d3 ?? dice[2];
        if (![a, b, c].every(Number.isFinite) || [a, b, c].some(v => v < 1 || v > 6)) continue;

        const total = number(firstValue(item, [
            "Tong", "tong", "tong", "total", "sum", "point", "points"
        ])) ?? (a + b + c);
        if (!Number.isFinite(total)) continue;

        const resultRaw = firstValue(item, [
            "Ket_qua", "ket_qua", "ket_qua", "result", "outcome", "side", "type", "prediction"
        ]);

        map.set(phien, {
            phien,
            ket_qua: normalizeOutcome(resultRaw, total),
            tong: total,
            xuc_xac_1: a,
            xuc_xac_2: b,
            xuc_xac_3: c,
            created_at: firstValue(item, ["created_at", "createdAt", "timestamp", "time", "date"]) ?? null
        });
    }

    return [...map.values()].sort((a, b) => a.phien - b.phien);
}

function contiguousHistory(records) {
    const sorted = [...records]
        .filter(x => Number.isInteger(Number(x.phien)))
        .sort((a, b) => Number(a.phien) - Number(b.phien));
    if (sorted.length < OMEGA_CONFIG.minHistory) return [];

    const out = [sorted.at(-1)];
    for (let i = sorted.length - 2; i >= 0; i--) {
        if (Number(sorted[i + 1].phien) - Number(sorted[i].phien) !== 1) break;
        out.unshift(sorted[i]);
    }
    return out;
}

function loadHistory() {
    try {
        if (!fs.existsSync(DATA_FILE)) return [];
        const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        const rows = Array.isArray(data) ? data : data.history;
        return Array.isArray(rows) ? parseApiRecords(rows) : [];
    } catch (e) {
        console.error(`[DATA] ${e.message}`);
        return [];
    }
}

function saveHistory(history) {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const normalized = parseApiRecords(history);
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        history: normalized,
        total_sessions: normalized.length,
        last_updated: vnNow()
    }));
}

function saveStatsFile() {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify({
        ...stats,
        api_url: API_URL,
        last_updated: vnNow()
    }));
}

function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            const saved = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
            stats = { ...stats, ...saved };
        }
    } catch (_) {}
}

function verifyPrediction(history) {
    const prediction = stats.last_prediction;
    if (!prediction) return;

    const actualRow = history.find(x => Number(x.phien) === Number(prediction.phien));
    if (!actualRow) return;

    const actual = normalizeOutcome(actualRow.ket_qua, actualRow.tong).toUpperCase();
    const predicted = String(prediction.prediction).toUpperCase();
    const ok = predicted === actual;

    stats.total++;
    if (ok) stats.correct++; else stats.wrong++;
    stats.history.push({
        phien: actualRow.phien,
        prediction: prediction.prediction,
        actual: actual === "TAI" ? "TAI" : "XIU",
        confidence: prediction.confidence,
        status: prediction.status,
        correct: ok,
        timestamp: vnNow()
    });
    stats.last_prediction = null;
    saveStatsFile();
}

async function fetchLatest() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(API_URL, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "Cache-Control": "no-cache"
            },
            cache: "no-store",
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`API HTTP ${response.status}`);
        return parseApiRecords(await response.json());
    } finally {
        clearTimeout(timer);
    }
}

async function collect() {
    let history = loadHistory();
    loadStats();
    let lastSeen = history.at(-1)?.phien ?? 0;
    let lastAnalyzed = null;

    while (true) {
        try {
            const apiRecords = await fetchLatest();
            runtime.last_api_sync = vnNow();
            runtime.api_ok = true;
            runtime.error = null;
            if (apiRecords.length) {
                const existing = new Set(history.map(x => Number(x.phien)));
                const newRecords = apiRecords.filter(x => !existing.has(Number(x.phien)));
                if (newRecords.length) {
                    history.push(...newRecords);
                    history = parseApiRecords(history);
                    saveHistory(history);
                }

                const latest = history.at(-1);
                if (latest && Number(latest.phien) > Number(lastSeen)) {
                    lastSeen = latest.phien;
                    runtime.last_session = latest.phien;
                    verifyPrediction(history);
                }

                if (latest && lastAnalyzed !== latest.phien) {
                    const analysisHistory = contiguousHistory(history);
                    if (analysisHistory.length >= OMEGA_CONFIG.minHistory) {
                        const result = predictor.predict(analysisHistory);
                        const nextPhien = Number(latest.phien) + 1;
                        const prediction = result.prediction === "T" ? "TAI" : result.prediction === "X" ? "XIU" : null;
                        const confidence = Math.round((Number(result.confidence) || 0) * 100);

                        if (prediction && result.status !== "NO_SIGNAL") {
                            stats.last_prediction = {
                                phien: nextPhien,
                                prediction,
                                confidence,
                                status: result.status
                            };
                            stats.total_predictions_made++;
                            runtime.last_prediction = stats.last_prediction;
                            saveStatsFile();
                        }
                        lastAnalyzed = latest.phien;
                    }
                }
            }
        } catch (e) {
            runtime.api_ok = false;
            runtime.error = e?.name === "AbortError" ? "timeout" : String(e?.message || e);
            console.error(`[API] ${runtime.error}`);
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

const http = require("http");
const PORT = Number(process.env.PORT) || 10000;

let runtime = {
    started_at: vnNow(),
    last_api_sync: null,
    last_session: null,
    last_prediction: null,
    api_ok: false,
    error: null
};

function startHealthServer() {
    const server = http.createServer((req, res) => {
        const body = req.url === "/health" || req.url === "/"
            ? { status: "ok", service: "anh-khoi-sunwin", runtime, api: API_URL }
            : { status: "ok" };
        const payload = JSON.stringify(body);
        res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Length": Buffer.byteLength(payload)
        });
        res.end(payload);
    });
    server.listen(PORT, "0.0.0.0", () => {
        console.log(`Render server listening on 0.0.0.0:${PORT}`);
    });
    return server;
}

module.exports = {
    API_URL,
    OmegaBridgeModel,
    OmegaNormalizer,
    OMEGA_CONFIG,
    parseApiRecords,
    contiguousHistory
};

process.on("SIGINT", () => {
    saveStatsFile();
    process.exit(0);
});

if (require.main === module) {
    startHealthServer();
    collect().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
