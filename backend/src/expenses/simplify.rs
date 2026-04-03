use std::collections::HashMap;

use rust_decimal::Decimal;
use uuid::Uuid;

use super::model::SimplifiedDebt;

/// Lightweight row needed from the expenses table.
pub struct ExpenseRow {
    pub id: Uuid,
    pub paid_by: Uuid,
    pub amount: Decimal,
}

/// Lightweight row needed from the expense_splits table.
pub struct SplitRow {
    pub expense_id: Uuid,
    pub user_id: Uuid,
    pub share: Decimal,
}

/// Compute simplified debts using the min-cash-flow (greedy) algorithm.
///
/// 1. For every expense, the payer's balance increases by the full amount and
///    each split participant's balance decreases by their share.
/// 2. Separate members into creditors (positive balance) and debtors (negative
///    balance).
/// 3. Greedily settle the largest creditor against the largest debtor until all
///    balances are zero.
pub fn simplify_debts(expenses: &[ExpenseRow], splits: &[SplitRow]) -> Vec<SimplifiedDebt> {
    // 1. Build net balance per user.
    let mut balance: HashMap<Uuid, Decimal> = HashMap::new();

    for exp in expenses {
        *balance.entry(exp.paid_by).or_insert(Decimal::ZERO) += exp.amount;
    }

    for split in splits {
        *balance.entry(split.user_id).or_insert(Decimal::ZERO) -= split.share;
    }

    // 2. Partition into creditors (+) and debtors (-).
    let mut creditors: Vec<(Uuid, Decimal)> = Vec::new();
    let mut debtors: Vec<(Uuid, Decimal)> = Vec::new();

    for (user, bal) in &balance {
        if *bal > Decimal::ZERO {
            creditors.push((*user, *bal));
        } else if *bal < Decimal::ZERO {
            debtors.push((*user, -*bal)); // store as positive amount owed
        }
    }

    // 3. Greedy settlement: always pair the largest creditor with the largest debtor.
    let mut debts: Vec<SimplifiedDebt> = Vec::new();

    while !creditors.is_empty() && !debtors.is_empty() {
        // Sort descending so the largest is last (cheap to pop).
        creditors.sort_by(|a, b| a.1.cmp(&b.1));
        debtors.sort_by(|a, b| a.1.cmp(&b.1));

        let (creditor_id, credit) = creditors.last().copied().unwrap();
        let (debtor_id, debt) = debtors.last().copied().unwrap();

        let settle = credit.min(debt);

        debts.push(SimplifiedDebt {
            from: debtor_id,
            to: creditor_id,
            amount: settle,
        });

        // Update or remove creditor.
        if credit == settle {
            creditors.pop();
        } else {
            creditors.last_mut().unwrap().1 -= settle;
        }

        // Update or remove debtor.
        if debt == settle {
            debtors.pop();
        } else {
            debtors.last_mut().unwrap().1 -= settle;
        }
    }

    debts
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    fn uid(n: u128) -> Uuid {
        Uuid::from_u128(n)
    }

    #[test]
    fn two_people_one_expense() {
        let alice = uid(1);
        let bob = uid(2);

        let expenses = vec![ExpenseRow {
            id: uid(100),
            paid_by: alice,
            amount: dec!(100),
        }];
        let splits = vec![
            SplitRow { expense_id: uid(100), user_id: alice, share: dec!(50) },
            SplitRow { expense_id: uid(100), user_id: bob, share: dec!(50) },
        ];

        let debts = simplify_debts(&expenses, &splits);
        assert_eq!(debts.len(), 1);
        assert_eq!(debts[0].from, bob);
        assert_eq!(debts[0].to, alice);
        assert_eq!(debts[0].amount, dec!(50));
    }

    #[test]
    fn already_settled() {
        let alice = uid(1);
        let bob = uid(2);

        let expenses = vec![
            ExpenseRow { id: uid(100), paid_by: alice, amount: dec!(50) },
            ExpenseRow { id: uid(101), paid_by: bob, amount: dec!(50) },
        ];
        let splits = vec![
            SplitRow { expense_id: uid(100), user_id: alice, share: dec!(25) },
            SplitRow { expense_id: uid(100), user_id: bob, share: dec!(25) },
            SplitRow { expense_id: uid(101), user_id: alice, share: dec!(25) },
            SplitRow { expense_id: uid(101), user_id: bob, share: dec!(25) },
        ];

        let debts = simplify_debts(&expenses, &splits);
        assert!(debts.is_empty());
    }
}
