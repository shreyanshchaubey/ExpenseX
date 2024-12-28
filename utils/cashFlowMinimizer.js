class Pair {
    constructor(key, value) {
        this.key = key;
        this.value = value;
    }
}

class CashFlowMinimizer {
    constructor() {
        this.minQ = [];
        this.maxQ = [];
        this.settlements = [];
    }

    constructMinMaxQ(amount) {
        for (let i = 0; i < amount.length; ++i) {
            if (amount[i] === 0) continue;
            if (amount[i] > 0) {
                this.maxQ.push(new Pair(i, amount[i]));
            } else {
                this.minQ.push(new Pair(i, amount[i]));
            }
        }
        // Sort in ascending order for maxQ (creditors)
        this.maxQ.sort((a, b) => b.value - a.value);
        // Sort in descending order for minQ (debtors)
        this.minQ.sort((a, b) => a.value - b.value);
    }

    solveTransaction(userMap) {
        while (this.minQ.length > 0 && this.maxQ.length > 0) {
            const maxCreditEntry = this.maxQ.pop();
            const maxDebitEntry = this.minQ.pop();

            const transaction_val = maxCreditEntry.value + maxDebitEntry.value;
            const debtor = maxDebitEntry.key;
            const creditor = maxCreditEntry.key;
            let owed_amount;

            if (transaction_val === 0) {
                owed_amount = maxCreditEntry.value;
            } else if (transaction_val < 0) {
                owed_amount = maxCreditEntry.value;
                maxDebitEntry.value = transaction_val;
                this.minQ.push(maxDebitEntry);
                this.minQ.sort((a, b) => a.value - b.value);
            } else {
                owed_amount = -maxDebitEntry.value;
                maxCreditEntry.value = transaction_val;
                this.maxQ.push(maxCreditEntry);
                this.maxQ.sort((a, b) => b.value - a.value);
            }

            this.settlements.push({
                from: userMap[debtor],
                to: userMap[creditor],
                amount: Math.abs(owed_amount)
            });
        }
        return this.settlements;
    }

    minCashFlow(expenses, members) {
        const n = members.length;
        const amount = new Array(n).fill(0);
        const userMap = {};
        const userIndexMap = {};

        // Create user mapping
        members.forEach((member, index) => {
            userMap[index] = member;
            userIndexMap[member] = index;
        });

        // Calculate net amount for each person
        expenses.forEach(expense => {
            const paidByIndex = userIndexMap[expense.paidBy];
            amount[paidByIndex] += expense.amount;

            // Split amount equally among participants
            const shareAmount = expense.amount / expense.participants.length;
            expense.participants.forEach(participant => {
                const participantIndex = userIndexMap[participant];
                amount[participantIndex] -= shareAmount;
            });
        });

        this.constructMinMaxQ(amount);
        return this.solveTransaction(userMap);
    }
}

module.exports = CashFlowMinimizer;
