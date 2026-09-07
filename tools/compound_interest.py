"""Compound interest calculator (CLI)."""

import argparse


def compound_interest(principal: float, annual_rate: float, compounds_per_year: int, years: float) -> tuple[float, float]:
    """Return (final_amount, total_interest) for compound interest."""
    final_amount = principal * (1 + annual_rate / compounds_per_year) ** (compounds_per_year * years)
    total_interest = final_amount - principal
    return final_amount, total_interest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Calculate compound interest.")
    parser.add_argument("principal", type=float, help="Initial principal amount")
    parser.add_argument("annual_rate", type=float, help="Annual interest rate (e.g. 0.05 for 5%%)")
    parser.add_argument("compounds_per_year", type=int, help="Number of times interest compounds per year")
    parser.add_argument("years", type=float, help="Total number of years")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    final_amount, total_interest = compound_interest(
        args.principal, args.annual_rate, args.compounds_per_year, args.years
    )

    print(f"Principal:          ${args.principal:,.2f}")
    print(f"Annual Rate:        {args.annual_rate * 100:.2f}%")
    print(f"Compounds/Year:     {args.compounds_per_year}")
    print(f"Years:              {args.years}")
    print(f"Final Amount:       ${final_amount:,.2f}")
    print(f"Interest Earned:    ${total_interest:,.2f}")


if __name__ == "__main__":
    main()
