import { DefaultNamingStrategy } from 'typeorm';

/** pgloader folds MySQL camelCase columns to lowercase unquoted PG identifiers. */
export class PostgresLowercaseNamingStrategy extends DefaultNamingStrategy {
  columnName(
    propertyName: string,
    customName: string,
    _embeddedPrefixes: string[],
  ): string {
    return (customName ?? propertyName).toLowerCase();
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    const name =
      relationName +
      referencedColumnName.charAt(0).toUpperCase() +
      referencedColumnName.slice(1);
    return name.toLowerCase();
  }
}
