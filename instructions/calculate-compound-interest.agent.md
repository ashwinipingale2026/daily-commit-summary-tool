# Calculate Compound Interest

- Use `tools/compound_interest.py` when the user asks to calculate compound interest, final amount, or interest earned on a principal over time.
- Applies whenever the request provides (or implies) principal, annual rate, compounding frequency, and time period.
- Invoke via command line with positional arguments, in this exact order:
  ```
  python tools/compound_interest.py <principal> <annual_rate> <compounds_per_year> <years>
  ```
  + `principal` — initial amount, plain number (e.g. `1000`).
  + `annual_rate` — decimal fraction, not a percentage (e.g. `0.05` for 5%).
  + `compounds_per_year` — integer compounding frequency (e.g. `12` for monthly, `4` for quarterly, `1` for annually).
  + `years` — total number of years, can be fractional (e.g. `2.5`).
- Convert any percentage given by the user (e.g. "5%") to decimal form (`0.05`) before passing it as `annual_rate`.
- Run the command in a terminal and capture its output — do not recompute the values manually.
- Present results to the user as a short summary, not raw terminal output, including:
  + Principal
  + Annual rate (as a percentage)
  + Compounding frequency
  + Time period
  + Final amount
  + Interest earned
- Format currency values with a `$` sign and thousands separators (e.g. `$1,647.01`).
- If any required input is missing or ambiguous, ask the user for it before running the script.
