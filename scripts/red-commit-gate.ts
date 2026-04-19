/**
 * RED-spec commit gate (016).
 *
 * Pure helper + tiny CLI used by the lefthook pre-commit `typecheck` step to
 * decide whether to skip typecheck. We skip when the staged commit subject
 * matches `^spec\(\d+\): RED\b` — the documented RED-state authoring commit
 * format. All other subjects fall through and run typecheck as before.
 *
 * Bootstrap stub: `shouldSkipTypecheck` returns false. The real regex is
 * implemented in task 3 of this spec; this stub exists so the colocated test
 * file imports cleanly during the RED commit.
 */

export function shouldSkipTypecheck(_: { readonly commitSubject: string }): boolean {
	return false;
}
