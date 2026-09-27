# Demo video script (about 2.5 minutes)

**0:00–0:20 · Hook (face cam or title slide)**
"This message landed in a student group last month: *'Selected without interview, pay ₹1,499 registration fee.'*
Thousands of students fall for offers like this every year. We built FakeHire to catch them."

**0:20–1:10 · Live demo: Dashboard → Check a Job**
1. Open the **Dashboard**. In the hero box, click **Pay-to-join scam** (it jumps straight to the result).
2. Point at the gauge: "High risk." Then the ML probability vs the rule score.
3. **Highlighted post** tab: "The model tells you *why*: 'without interview', 'Pay Rs 1499', 'Aadhaar'."
4. **Red flags** tab: read one tip.
5. **What each model says** tab: "Seven models plus two ensembles. Text models catch it; metadata models add
   evidence."
6. Click **🏢 Genuine internship** → Check: "Low risk, 1%. It doesn't cry wolf."

**1:10–1:40 · Model Lab**
- Show the comparison table: "We trained 7 classic ML models and 2 ensembles. Stacking wins with 0.96 precision and
  0.925 F1 on a held-out test set."
- The confusion matrix: "154 scams caught, only 6 false alarms out of 3,400 real jobs."
- The imbalance chart: "Only 4.8% of posts are fake. Accuracy would lie, so we used class weights and tuned
  thresholds."

**1:40–2:05 · Scam Patterns**
- "Posts with no company logo are 8× more likely to be fake."
- Pick an archetype in the PCA scatter: "K-Means found 8 scam archetypes, like work-from-home typing jobs and fake
  recruiters."

**2:05–2:30 · Impact and close**
- Batch CSV upload: "Placement cells can check hundreds of posts at once."
- "Report fraud at cybercrime.gov.in or 1930. FakeHire: check before you pay."
