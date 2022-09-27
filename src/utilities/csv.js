function serialize(keys, rows) {
  const rowStrings = rows.map((row) =>
    keys
      .map((key) => {
        const value = row[key];
        if (value === undefined) {
          throw new Error(
            `Undefined key: ${key} on row: ${JSON.stringify(row)}!`
          );
        }
        return value === null ? "" : String(value);
      })
      .join(",")
  );
  return `${keys.join(",")}
${rowStrings.join("\n")}`;
}

module.exports = {serialize};
