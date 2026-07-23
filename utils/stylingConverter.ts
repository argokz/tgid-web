/**
 * Утилиты для динамической конвертации стилей на основе атрибутов
 * Помогает перенести логику стилизации WMS (SLD/CSS) в выражения MapLibre GL
 */

export type StyleOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'contains';

export interface StyleRule {
  attribute: string;
  operator: StyleOperator;
  value: any;
  styleValue: any; // Значение стиля (цвет, ширина и т.д.), которое будет применено если условие истинно
}

export interface LayerStyling {
  property: string; // Свойство MapLibre (например, 'line-color', 'circle-radius')
  defaultValue: any;
  rules: StyleRule[];
}

/**
 * Конвертирует массив правил в выражение MapLibre 'case'
 */
export function createMapboxExpression(styling: LayerStyling): any {
  if (!styling.rules || styling.rules.length === 0) {
    return styling.defaultValue;
  }

  const expression: any[] = ['case'];

  styling.rules.forEach(rule => {
    let condition: any[];

    switch (rule.operator) {
      case 'in':
        condition = ['in', ['get', rule.attribute], ['literal', rule.value]];
        break;
      case 'contains':
        // Для строк
        condition = ['in', rule.value, ['get', rule.attribute]];
        break;
      default:
        condition = [rule.operator, ['get', rule.attribute], rule.value];
    }

    expression.push(condition);
    expression.push(rule.styleValue);
  });

  // Добавляем дефолтное значение в конец
  expression.push(styling.defaultValue);

  return expression;
}

/**
 * Пример использования для ut_view (участки трубопроводов)
 * Можно использовать этот метод для создания более гибких стилей
 */
export function createPipelineStyle(config: any): LayerStyling {
  return {
    property: 'line-color',
    defaultValue: config.defaultPipe.color,
    rules: [
      { attribute: 'externalsignlineid', operator: '==', value: 1, styleValue: config.doubleBlackPipe.color },
      { attribute: 'externalsignlineid', operator: '==', value: 2, styleValue: config.singleRedPipe.color },
      { attribute: 'externalsignlineid', operator: '==', value: 4, styleValue: config.singleRedPipe.color },
      { attribute: 'externalsignlineid', operator: '==', value: 3, styleValue: config.singleBluePipe.color },
      { attribute: 'externalsignlineid', operator: '==', value: 5, styleValue: config.singleBluePipe.color },
    ]
  };
}
