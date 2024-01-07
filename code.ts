figma.showUI(__html__)

figma.ui.onmessage = async(text: string) => {
  await Promise.all([
    figma.loadFontAsync({ family: "Inter", style: "Regular" }),
    figma.loadFontAsync({ family: "Inter", style: "Medium" }),
  ]);

  const relations = await parseErd(text);
  const sortedRelations = sortRelations(relations);
  const nodeByName = {} as { [key: string]: ShapeWithTextNode };
  const [startX, startY] = [
    figma.viewport.center.x,
    figma.viewport.center.y,
  ];

  sortedRelations.forEach((relation, i) => {
    const fromNode = nodeByName[relation.from] || figma.createShapeWithText();
    fromNode.text.characters = relation.from;
    fromNode.text.fontSize = 24;
    fromNode.shapeType = 'SQUARE';
    fromNode.x = startX;
    fromNode.y = startY + 200 * i;
    nodeByName[relation.from] ||= fromNode;

    const toNode = nodeByName[relation.to] || figma.createShapeWithText();
    toNode.text.characters = relation.to;
    fromNode.text.fontSize = 24;
    toNode.shapeType = 'SQUARE';
    toNode.x = fromNode.x - 200 * i;
    toNode.y = fromNode.y - 200 * i;
    nodeByName[relation.to] ||= toNode;

    const connector = figma.createConnector();
    connector.connectorStart = {
      endpointNodeId: fromNode.id,
      magnet: "AUTO",
    };
    connector.connectorEnd = {
      endpointNodeId: toNode.id,
      magnet: "AUTO",
    };
    connector.strokeWeight = 4;
  });

  const nodes = Object.keys(nodeByName).map(key => nodeByName[key]);
  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);
  figma.closePlugin();
}

/**
 * 右から左に図を作っていくような順番に並び替える
 * 
 * @param relations 
 * @param sortedRelations 
 * @returns 
 */
function sortRelations(
  relations: Relation[],
  sortedRelations: Relation[] = [],
): Relation[] {

  if(relations.length === 0) {
    return sortedRelations;
  }

  const nextNodeName = getLastNodeName(relations);
  const nextRelations = relations.filter(relation => relation.from !== nextNodeName);
  const nextSortedRelations = [ ...sortedRelations, ...relations.filter(relation => relation.from === nextNodeName) ];
  return sortRelations(nextRelations, nextSortedRelations);
}

// もっとも他のノードから参照されていないノードを探す
function getLastNodeName(relations: Relation[]): string {
  const nodes = relations.map(relation => relation.from);
  nodes.push(...relations.map(relation => relation.to));
  const nodeNames = Array.from(new Set(nodes));
  const refferencedCountByNodeName = nodeNames
    .reduce((acc, nodeName) => {
      acc[nodeName] = 0;
      return acc;
    }, {} as { [key: string]: number });
  relations.forEach(relation => {
    refferencedCountByNodeName[relation.to]++;
  });

  return nodeNames.sort((a, b) => refferencedCountByNodeName[a] - refferencedCountByNodeName[b])[0];
}


type Relation = {
  from: string;
  to: string;
}

async function parseErd(erdText: string) {
  const relations: Relation[] = [];
  const lines = erdText.split("\n");

  const relationLines = lines.filter(line => line.includes("--"));
  const RIGHT_TO_LEFT = /\|\|--[o|\|][\|{]/;
  const LEFT_TO_RIGHT = /[\||}][o|\|]--\|\|/;
  const LABEL_SEPARATOR = ":";
  
  relationLines.forEach(relationLine => {
    if(RIGHT_TO_LEFT.test(relationLine)) {
      const [to, fromWithLabel] = relationLine.split(RIGHT_TO_LEFT);
      const from = fromWithLabel.split(LABEL_SEPARATOR)[0];
      relations.push({ from: from.trim(), to: to.trim() });
    } else if(LEFT_TO_RIGHT.test(relationLine)) {
      const [from, toWithLabel] = relationLine.split(LEFT_TO_RIGHT);
      const to = toWithLabel.split(LABEL_SEPARATOR)[0];
      relations.push({ from: from.trim(), to: to.trim() });
    }
  });

  return relations.reduce((acc, relation) => {
    const { from, to } = relation;
    if(!acc.find(r => r.from === from && r.to === to)) {
      acc.push(relation);
    }
    return acc;
  }, [] as Relation[]);
}
