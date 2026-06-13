import re

filepath = 'seed-demo-data.sql'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace column definition for ONLY OrderDetails (not ReturnOrderDetails)
content = content.replace(
    'INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, SubTotal, CreatedAt, UpdatedAt, IsDeleted)',
    'INSERT INTO OrderDetails (Id, OrderId, SkuId, SkuSnapshotName, SkuSnapshotCode, Quantity, ReturnedQuantity, UnitPrice, CostPrice, CategorySnapshotName, SubTotal, CreatedAt, UpdatedAt, IsDeleted)'
)

lines = content.split('\n')
for i, line in enumerate(lines):
    if line.startswith("SELECT '22222222"):
        new_line = re.sub(r'(\d+), (DATE_SUB)', r"50000, 'Trà demo', \1, \2", line)
        lines[i] = new_line

with open(filepath, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print("Fixed seed-demo-data.sql properly for real")
