import React from "react";
import { StandardNavigationToolsUiItemsProvider, UiItemsProvider, Widget } from "@itwin/appui-react";
import { CategoriesTreeComponent, createTreeWidget, ModelsTreeComponent } from "@itwin/tree-widget-react";
import { createPropertyGrid } from "@itwin/property-grid-react";
import { MeasureToolsUiItemsProvider } from "@itwin/measure-tools-react";
import { MapLayersUiItemsProvider } from "@itwin/map-layers";
import { IModelConnection } from "@itwin/core-frontend";
import { createStorage, SelectionStorage } from "@itwin/unified-selection";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";

let unifiedSelectionStorage: SelectionStorage | undefined;
export function getUnifiedSelectionStorage(): SelectionStorage {
  if (!unifiedSelectionStorage) {
    unifiedSelectionStorage = createStorage();
    IModelConnection.onClose.addListener((imodel) => {
      if (unifiedSelectionStorage) {
        unifiedSelectionStorage.clearStorage({ imodelKey: imodel.key });
      }
    });
  }
  return unifiedSelectionStorage;
}

const schemaContextCache = new Map<string, SchemaContext>();
export function getSchemaContext(imodel: IModelConnection) {
  const key = imodel.getRpcProps().key;
  let schemaContext = schemaContextCache.get(key);
  if (!schemaContext) {
    const schemaLocater = new ECSchemaRpcLocater(imodel.getRpcProps());
    schemaContext = new SchemaContext();
    schemaContext.addLocater(schemaLocater);
    schemaContextCache.set(key, schemaContext);
    imodel.onClose.addOnce(() => schemaContextCache.delete(key));
  }
  return schemaContext;
}

export const getUiProviders = (): UiItemsProvider[] => {
  return [
    {
      id: "TreeWidgetUiItemsProvider",
      getWidgets: (): ReadonlyArray<Widget> => [
        createTreeWidget({
          trees: [
            {
              id: ModelsTreeComponent.id,
              getLabel: () => ModelsTreeComponent.getLabel(),
              render: () => <ModelsTreeComponent getSchemaContext={getSchemaContext} selectionStorage={getUnifiedSelectionStorage()} />,
            },
            {
              id: CategoriesTreeComponent.id,
              getLabel: () => CategoriesTreeComponent.getLabel(),
              render: () => <CategoriesTreeComponent getSchemaContext={getSchemaContext} selectionStorage={getUnifiedSelectionStorage()} />,
            },
          ],
        }),
      ],
    },
    {
      id: "PropertyGridUiItemsProvider",
      getWidgets: (): ReadonlyArray<Widget> => [createPropertyGrid({ selectionStorage: getUnifiedSelectionStorage() })],
    },
    new MeasureToolsUiItemsProvider(),
    new MapLayersUiItemsProvider(),
    new StandardNavigationToolsUiItemsProvider(),
  ];
};
