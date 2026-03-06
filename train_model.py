
import os
import json
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split    
from sklearn.metrics import accuracy_score

# ---------- BASE DIRECTORY ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_PATH = os.path.join(BASE_DIR, "mindflexx_dataset.csv")
MODEL_PATH = os.path.join(BASE_DIR, "model_rules.json")

# ---------- LOAD DATA ----------
data = pd.read_csv(DATA_PATH)
print(data.head())
print("Dataset size:", len(data))

X = data[
[
"avgRT",
"errorRate",
"avgDifficulty",
"variance",
"streak",
"sessionDuration"
]
]

y = data["label"]

# ---------- TRAIN MODEL ----------
model = DecisionTreeClassifier(max_depth=4)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model.fit(X_train, y_train)

pred = model.predict(X_test)

print("MODEL ACCURACY:", accuracy_score(y_test, pred))

tree = model.tree_
features = X.columns


# ---------- TREE → JSON ----------
def build_tree(node):

    if tree.feature[node] == -2:
        # leaf node
        value = tree.value[node][0]
        class_id = value.argmax()
        return {"class": model.classes_[class_id]}

    feature_name = features[tree.feature[node]]
    threshold = float(tree.threshold[node])

    return {
        "feature": feature_name,
        "threshold": threshold,
        "left": build_tree(tree.children_left[node]),
        "right": build_tree(tree.children_right[node])
    }


tree_json = build_tree(0)

# ---------- SAVE MODEL ----------
with open(MODEL_PATH, "w") as f:
    json.dump(tree_json, f, indent=2)

print("Model retrained automatically.")
print("New model saved to:", MODEL_PATH)

