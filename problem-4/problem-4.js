// A. Iterative loop.
// Time O(n), space O(1).
function sum_to_n_a(n) {
	const step = n < 0 ? -1 : 1;
	let sum = 0;

	for (let i = step; i !== n + step; i += step) {
		sum += i;
	}
	return sum;
}

// B. Closed-form arithmetic series (Gauss): n(n + 1) / 2.
// Time O(1), space O(1). Fastest by far. n(n + 1) is always even, so the division is exact.
// Caveat: the intermediate product n(n + 1) is ~2x the result
function sum_to_n_b(n) {
	const abs = Math.abs(n);
	const sum = (abs * (abs + 1)) / 2;
	return n < 0 ? -sum : sum;
}

// C. Linear recursion: sum(n) = n + sum(n - 1).
// Time O(n), space O(n) because of the call stack. Elegant but the least practical:
// large n (roughly > 10k) throws "Maximum call stack size exceeded"; JS has no tail-call optimisation.
function sum_to_n_c(n) {
	if (n === 0) return 0;
	return n > 0 ? n + sum_to_n_c(n - 1) : n + sum_to_n_c(n + 1);
}


