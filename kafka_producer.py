from kafka import KafkaProducer
import pandas as pd
import json
import time

# Read CSV
df = pd.read_csv("CMS_DataSet.csv")

# Kafka producer
producer = KafkaProducer(
    bootstrap_servers="localhost:9092",
    value_serializer=lambda v: json.dumps(v).encode("utf-8")
)

# Send each row as JSON
for _, row in df.iterrows():
    message = row.to_dict()
    producer.send("fraud_input", value=message)
    print(f"Sent: {message}")
    time.sleep(1)  # simulate streaming

producer.flush()
producer.close()
