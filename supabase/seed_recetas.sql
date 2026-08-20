-- ============================================================
-- SEED: Catálogo de Recetas (ingredientes exactos del PDF)
-- Borra primero todas las recetas de catálogo (user_id IS NULL)
-- y las reinserta limpias.
--
-- v2: se agregan cantidad + unidad numéricas a cada ingrediente
-- cuando el PDF da un valor exacto y único (para que el cálculo
-- automático de calorías funcione una vez que se ligue cada
-- ingrediente a un alimento del catálogo — ver "vinculación
-- asistida", pendiente como paso siguiente). El texto de
-- `descripcion` NO se modifica frente a la v1 (ya coincidía con
-- el PDF), y NO se inventan cantidades donde el PDF da un rango
-- ("60-100 ml"), una alternativa ("o"), o mezcla varios alimentos
-- en una sola línea sin cantidad individual — esas quedan con
-- cantidad/unidad en NULL, igual que antes.
-- ============================================================
DO $$
DECLARE rid uuid;
BEGIN

-- Limpiar recetas de catálogo previas
DELETE FROM recetas WHERE user_id IS NULL;

-- ============================================================
-- DESAYUNOS
-- ============================================================

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Omelette', '🍳', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'3 pzas de huevo',3,'pieza'),
  (rid,2,'2 rebanadas de pechuga de pavo',2,'rebanada'),
  (rid,3,'Puño de espinacas, jitomate, pimiento y champiñones',NULL,NULL),
  (rid,4,'30g de queso oaxaca',30,'gramos'),
  (rid,5,'⅓ pza (30g) de aguacate',30,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Tostada de aguacate', '🥑', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 pzas de pan integral',2,'pieza'),
  (rid,2,'⅓ pza (40g) de aguacate (machacar con sal y limón)',40,'gramos'),
  (rid,3,'3 pzas de huevo al gusto (duro, revuelto, estrellado)',3,'pieza'),
  (rid,4,'60g de queso panela',60,'gramos'),
  (rid,5,'1 jitomate en rodajas',1,'pieza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Chilaquiles', '🌮', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'60g de totopos horneados',60,'gramos'),
  (rid,2,'Salsa de chilaquiles (tomate, ajo, cebolla, cilantro, chile serrano, agua)',NULL,NULL),
  (rid,3,'3 huevos al gusto',3,'pieza'),
  (rid,4,'30g de queso panela',30,'gramos'),
  (rid,5,'⅓ pza (30g) de aguacate',30,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Huevo con jamón', '🍳', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 huevos',2,'pieza'),
  (rid,2,'¼ tza de claras',0.25,'taza'),
  (rid,3,'2 rebanadas de pechuga de pavo',2,'rebanada'),
  (rid,4,'⅓ pza (40g) de aguacate',40,'gramos'),
  (rid,5,'2 tortillas de maíz',2,'pieza'),
  (rid,6,'30g de queso panela',30,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Hot cakes de avena', '🥞', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'60g de avena en hojuelas',60,'gramos'),
  (rid,2,'1 plátano pequeño o 1 manzana cocida',NULL,NULL),
  (rid,3,'60-100 ml de leche',NULL,NULL),
  (rid,4,'Pizca de canela, vainilla y polvo para hornear',NULL,NULL),
  (rid,5,'1 huevo',1,'pieza'),
  (rid,6,'5g de mantequilla sin sal (para la sartén)',5,'gramos');
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Mezcla la avena, plátano o manzana, leche, canela, vainilla, polvo para hornear y huevo hasta obtener una mezcla homogénea.'),
  (rid,2,'Calienta la sartén con 5g de mantequilla sin sal.'),
  (rid,3,'Vierte porciones de mezcla y cocina hasta que aparezcan burbujas, luego voltea.'),
  (rid,4,'Sirve con topping de tu elección: mermelada, fruta o nueces.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pan francés', '🍞', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 pzas de pan integral',2,'pieza'),
  (rid,2,'1 huevo',1,'pieza'),
  (rid,3,'5 cdas de leche',5,'cucharada'),
  (rid,4,'Canela, vainilla y edulcorante (opcional)',NULL,NULL),
  (rid,5,'5g de mantequilla sin sal (para la sartén)',5,'gramos'),
  (rid,6,'Topping: mermelada sin azúcar, 1 eq. de fruta, 6 nueces',NULL,NULL);
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Bate el huevo con la leche, canela, vainilla y edulcorante.'),
  (rid,2,'Remoja las rebanadas de pan en la mezcla.'),
  (rid,3,'Calienta la sartén con mantequilla y cocina el pan hasta dorar por ambos lados.'),
  (rid,4,'Sirve con mermelada sin azúcar, fruta y nueces.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Huevo a la mexicana', '🍳', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 pzas de huevo',2,'pieza'),
  (rid,2,'1 jitomate, cebolla y chile serrano',NULL,NULL),
  (rid,3,'2 rebanadas (60g) de queso panela',60,'gramos'),
  (rid,4,'⅓ pza (40g) de aguacate',40,'gramos'),
  (rid,5,'1-2 tortillas de maíz',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Huevo con papas', '🍳', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'3 pzas de huevo',3,'pieza'),
  (rid,2,'¼ tza de claras de huevo',0.25,'taza'),
  (rid,3,'¼ tza de papa cocida',0.25,'taza'),
  (rid,4,'2 rebanadas de queso panela',2,'rebanada'),
  (rid,5,'1 tortilla de maíz',1,'pieza'),
  (rid,6,'1 pimiento y cebolla',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Sándwich de huevo', '🥪', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 rebanadas de pan integral',2,'rebanada'),
  (rid,2,'2 huevos al gusto',2,'pieza'),
  (rid,3,'2 rebanadas de pechuga de pavo',2,'rebanada'),
  (rid,4,'2 rebanadas (60g) de queso panela',60,'gramos'),
  (rid,5,'⅓ pza (40g) de aguacate machacado con sal y limón',40,'gramos'),
  (rid,6,'Jitomate, cebolla y lechuga o espinaca',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Huevo en salsa verde', '🍳', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 pzas de huevo',2,'pieza'),
  (rid,2,'¼ tza de ejotes cocidos',0.25,'taza'),
  (rid,3,'Salsa verde (tomate, ajo, chile, cebolla)',NULL,NULL),
  (rid,4,'2 rebanadas (60g) de queso panela',60,'gramos'),
  (rid,5,'⅓ pza (40g) de aguacate',40,'gramos'),
  (rid,6,'2 tortillas de maíz',2,'pieza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Calabaza rellena', '🎃', 'Desayuno', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1-2 pzas de calabaza (quitar el relleno)',NULL,NULL),
  (rid,2,'60g de carne molida',60,'gramos'),
  (rid,3,'30g de queso oaxaca o manchego',30,'gramos'),
  (rid,4,'1 jitomate, zanahoria en cubos, cebolla',NULL,NULL),
  (rid,5,'Sal y pimienta',NULL,NULL);
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Parte las calabazas a la mitad y retira un poco del centro; cuécelas 5–7 min hasta que suavicen.'),
  (rid,2,'Sofríe cebolla en un poco de aceite, agrega la carne molida y cocina hasta que cambie de color.'),
  (rid,3,'Incorpora jitomate, zanahoria (y la pulpa de la calabaza), sal y pimienta, y cocina unos minutos.'),
  (rid,4,'Rellena las calabazas con la mezcla, añade el queso encima y cocina tapado.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Tortilla española', '🥚', 'Desayuno', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 pzas de huevo',2,'pieza'),
  (rid,2,'1 papa cocida (140g)',140,'gramos'),
  (rid,3,'1 jitomate en rodajas',1,'pieza'),
  (rid,4,'⅓ pza (30g) de aguacate',30,'gramos');
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Calienta y engrasa la sartén.'),
  (rid,2,'Agrega el huevo; cuando comience a cocerse, agrega la papa y el jitomate.'),
  (rid,3,'Da la vuelta como si fuera omelette y sirve.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Burrito de pollo', '🌯', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 pza de pan pita integral',1,'pieza'),
  (rid,2,'1 cdita de mayonesa + chipotle',NULL,NULL),
  (rid,3,'60g de pechuga de pollo',60,'gramos'),
  (rid,4,'30g de queso panela',30,'gramos'),
  (rid,5,'Espinaca y jitomate',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Huevos rancheros', '🍳', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 pzas de huevo estrellados',2,'pieza'),
  (rid,2,'Salsa de jitomate (jitomate, cebolla, chile, ajo, sal, caldo de pollo)',NULL,NULL),
  (rid,3,'30g de queso panela',30,'gramos'),
  (rid,4,'1 cdita de aceite vegetal',1,'cucharadita'),
  (rid,5,'2 tortillas de maíz',2,'pieza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Baguette', '🥖', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 pza de baguette integral (sin migajón)',1,'pieza'),
  (rid,2,'1 cdita de aceite de oliva',1,'cucharadita'),
  (rid,3,'2 rebanadas de pechuga de pavo ahumada',2,'rebanada'),
  (rid,4,'60g de queso mozarella',60,'gramos'),
  (rid,5,'Lechuga, jitomate, uvas troceadas',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Wrap de pollo', '🌯', 'Desayuno', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 pza de pan pita',1,'pieza'),
  (rid,2,'120g de pechuga de pollo deshebrada',120,'gramos'),
  (rid,3,'60g de queso panela',60,'gramos'),
  (rid,4,'Lechuga, pepino, jitomate y zanahoria',NULL,NULL),
  (rid,5,'30g de aguacate machacado + chipotle',30,'gramos');

-- ============================================================
-- COLACIONES
-- ============================================================

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Rice cakes', '🍚', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 piezas de galletas de arroz sin azúcar',2,'pieza'),
  (rid,2,'½ cda (15g) de crema de cacahuate sin azúcar',15,'gramos'),
  (rid,3,'1 eq. de fruta',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Bites de yogurt', '🍦', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'Yogurt griego (capa gruesa)',NULL,NULL),
  (rid,2,'Fresas en rodajas',NULL,NULL),
  (rid,3,'Chocolate 70% cacao derretido',NULL,NULL),
  (rid,4,'1 cda de crema de cacahuate',1,'cucharada');
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Sobre un trozo de papel encerado coloca una capa gruesa de yogurt.'),
  (rid,2,'Agrega fresas en rodajas, chocolate derretido y crema de cacahuate.'),
  (rid,3,'Lleva al congelador por mínimo 1 hr y disfruta.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Fresas con crema', '🍓', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 tza de fresas picadas (200g)',200,'gramos'),
  (rid,2,'3 cdas de crema y 5 cdas de yogurt griego sin azúcar natural (o de coco)',NULL,NULL),
  (rid,3,'Vainilla y canela (opcional)',NULL,NULL),
  (rid,4,'Edulcorante al gusto',NULL,NULL),
  (rid,5,'6 nueces enteras',6,'pieza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Licuado', '🥤', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 tza de leche deslactosada',1,'taza'),
  (rid,2,'1 eq de fruta',NULL,NULL),
  (rid,3,'6 nueces',6,'pieza'),
  (rid,4,'30g de avena en hojuelas',30,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Bowl de yogurt', '🥣', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'90g de yogurt griego sin azúcar',90,'gramos'),
  (rid,2,'1 eq de fruta',NULL,NULL),
  (rid,3,'3 nueces troceadas y 1 cda de crema de cacahuate s/a',NULL,NULL),
  (rid,4,'5 galletas maría troceadas',5,'pieza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Panquecito express', '🧁', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'30g de avena en hojuelas',30,'gramos'),
  (rid,2,'½ plátano',0.5,'pieza'),
  (rid,3,'3 cdas de chía remojada',3,'cucharada'),
  (rid,4,'1 pza de huevo',1,'pieza'),
  (rid,5,'½ tza de leche',0.5,'taza'),
  (rid,6,'Vainilla y polvo para hornear',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Helado de fruta', '🍧', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 tza de leche deslactosada',1,'taza'),
  (rid,2,'1 eq de fruta de tu elección congelada',NULL,NULL),
  (rid,3,'3 nueces',3,'pieza'),
  (rid,4,'Edulcorante al gusto',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pan de plátano', '🍌', 'Colación', 'Medio', '1 rebanada (1/8 de pan)') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 plátanos maduros medianos',2,'pieza'),
  (rid,2,'2 huevos',2,'pieza'),
  (rid,3,'1 taza (90g) de avena molida',90,'gramos'),
  (rid,4,'¼ taza (60g) de yogurt natural sin azúcar o griego light',60,'gramos'),
  (rid,5,'1 cdita de polvo para hornear',1,'cucharadita'),
  (rid,6,'Canela, vainilla y 1 pizca de sal',NULL,NULL);
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Precalienta el horno a 180 °C.'),
  (rid,2,'Machaca los plátanos hasta hacerlos puré.'),
  (rid,3,'Agrega huevos, yogurt y vainilla; mezcla bien.'),
  (rid,4,'Incorpora la avena molida, polvo para hornear, canela y sal.'),
  (rid,5,'Vierte en un molde pequeño antiadherente o con papel encerado.'),
  (rid,6,'Hornea 35–40 min o hasta que al picar con un palillo salga limpio. Deja enfriar y divide en 8 rebanadas iguales.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Carlota de limón', '🍋', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'10 pzas de galletas maría',10,'pieza'),
  (rid,2,'125g de yogurt griego s/azúcar + jugo de limón + vainilla + edulcorante',125,'gramos'),
  (rid,3,'6 nueces troceadas',6,'pieza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Bolitas energéticas', '⚡', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'½ tza de avena en hojuelas',0.5,'taza'),
  (rid,2,'1 cda de crema de cacahuate s/azúcar',1,'cucharada'),
  (rid,3,'2 cdas de chispas de chocolate',2,'cucharada'),
  (rid,4,'1 plátano machacado',1,'pieza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Parfait de mango', '🥭', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 yogurt griego s/azúcar bebible sabor mango',1,'pieza'),
  (rid,2,'½ tza de mango congelado',0.5,'taza'),
  (rid,3,'2 cdas de chía previamente hidratada (5-10 min)',2,'cucharada');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Gelatina de yogurt', '🍮', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'90g de yogurt griego s/azúcar',90,'gramos'),
  (rid,2,'1 eq de fruta de tu elección',NULL,NULL),
  (rid,3,'3 cdas de leche',3,'cucharada'),
  (rid,4,'Grenetina disuelta en agua tibia',NULL,NULL);
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Pon en el fondo de un bowl la fruta de tu elección.'),
  (rid,2,'En otro recipiente, mezcla el yogurt con vainilla, edulcorante (opcional) y 1 sobre de grenetina disuelta en agua.'),
  (rid,3,'Mezcla bien e incorpora los ingredientes.'),
  (rid,4,'Vierte sobre la fruta y lleva a refrigerar mínimo 2 hrs.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Dorilocos', '🌶️', 'Colación', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'30g de totopos horneados o susalias enchiladas',30,'gramos'),
  (rid,2,'1 puño de cacahuates japoneses (aprox 20 pzas)',20,'pieza'),
  (rid,3,'1 tza de verduras (jícama, zanahoria, pepino)',1,'taza'),
  (rid,4,'Limón, sal y chile de tu preferencia',NULL,NULL);

-- ============================================================
-- COMIDAS
-- ============================================================

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Alambre de pollo', '🍗', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de pechuga de pollo (100g cocido)',120,'gramos'),
  (rid,2,'1 cdita de aceite para cocinar',1,'cucharadita'),
  (rid,3,'Pimiento, cebolla, champiñones y brócoli',NULL,NULL),
  (rid,4,'Sal, ajo, pimienta y 1 cdita de salsa de soya',NULL,NULL),
  (rid,5,'30g de queso oaxaca reducido en grasa',30,'gramos'),
  (rid,6,'3 tortillas de maíz',3,'pieza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Filete al ajo', '🐟', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 filete de pescado tilapia (aprox 180-200g)',NULL,NULL),
  (rid,2,'5g de mantequilla sin sal, ajo picado finamente, jugo de limón o naranja',NULL,NULL),
  (rid,3,'½ tza de arroz cocido con verduras',0.5,'taza'),
  (rid,4,'⅓ pza (60g) de aguacate',60,'gramos'),
  (rid,5,'Lechuga, jitomate, zanahoria, pepino',NULL,NULL),
  (rid,6,'¼ tza de garbanzos',0.25,'taza'),
  (rid,7,'30g de queso panela',30,'gramos'),
  (rid,8,'1 cdita de aceite de oliva, limón y sal',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Bistec con nopales', '🥩', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de bistec de res magro',120,'gramos'),
  (rid,2,'1 tza de nopales',1,'taza'),
  (rid,3,'30g de queso manchego o oaxaca bajo en grasa',30,'gramos'),
  (rid,4,'2 tortillas de maíz',2,'pieza'),
  (rid,5,'1 cdita de aceite vegetal',1,'cucharadita'),
  (rid,6,'⅓ pza (30g) de aguacate',30,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pollo a la jardinera', '🍗', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'100g de pechuga de pollo o 2 piernas de pollo cocidas',NULL,NULL),
  (rid,2,'Salsa: 3 jitomates, cebolla, ajo, sal, caldo de pollo, 1 cdita de aceite vegetal',NULL,NULL),
  (rid,3,'1 tza de zanahoria, chícharo y ejotes',1,'taza');
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Licúa 2 jitomates con cebolla, ajo, sal y un poco de caldo de pollo para hacer la salsa.'),
  (rid,2,'En una sartén, calienta aceite vegetal, vierte la salsa y deja hervir unos minutos.'),
  (rid,3,'Agrega 1 taza de zanahoria, chícharos y ejotes cocidos, luego incorpora el pollo cocido.'),
  (rid,4,'Cocina todo junto hasta que los sabores se integren y la salsa espese ligeramente.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Alambre de bistec', '🥩', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de bistec de res magro (contrafilete, solomillo, bola de res)',120,'gramos'),
  (rid,2,'1 pimiento, cebolla, champiñones y brócoli',NULL,NULL),
  (rid,3,'30g de queso manchego reducido en grasa',30,'gramos'),
  (rid,4,'2 tortillas de maíz o 4 tortillas mission (2=1)',NULL,NULL),
  (rid,5,'⅓ pza (40g) de aguacate',40,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Bowl de pollo', '🍗', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'½ taza de arroz integral',0.5,'taza'),
  (rid,2,'120g de pechuga marinada en salsa de soya, ajo y limón',120,'gramos'),
  (rid,3,'30g de queso panela en cubos',30,'gramos'),
  (rid,4,'½ aguacate en rebanadas o cubos',0.5,'pieza'),
  (rid,5,'1 huevo duro en rebanadas',1,'pieza'),
  (rid,6,'Jitomate, pepino, zanahoria rallada y lechuga al gusto',NULL,NULL),
  (rid,7,'1 cdita de aceite de oliva o ajonjolí tostado',1,'cucharadita'),
  (rid,8,'Limón, sal y pimienta al gusto',NULL,NULL);
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Arma un bowl con arroz integral, pollo asado marinado en soya, queso panela, aguacate, huevo duro y verduras frescas.'),
  (rid,2,'Añade aceite de oliva, limón, sal y pimienta.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pasta Estilo Alfredo', '🍝', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 tza de pasta cocida al dente',1,'taza'),
  (rid,2,'100g de pechuga de pollo',100,'gramos'),
  (rid,3,'60g de queso rallado (panela rallado, mozzarella light o parmesano natural)',60,'gramos'),
  (rid,4,'2 cdas (30g aprox.) de crema baja en grasa o crema light',30,'gramos'),
  (rid,5,'¼ taza de leche (opcional)',0.25,'taza'),
  (rid,6,'1 tza de brócoli o champiñones',1,'taza'),
  (rid,7,'½ diente de ajo finamente picado, sal y pimienta al gusto',0.5,'diente');
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Cocina la pasta al dente y reserva un poco del agua de cocción.'),
  (rid,2,'En una sartén, sella el pollo con aceite, retíralo y saltea el ajo.'),
  (rid,3,'Agrega la crema, leche y queso hasta formar una salsa cremosa.'),
  (rid,4,'Reincorpora el pollo y la pasta, mezcla y ajusta la consistencia con el agua reservada.'),
  (rid,5,'Sazona con sal y pimienta. Sirve con perejil o espinaca si deseas.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Rollito primavera de bistec', '🥢', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de bistec de res',120,'gramos'),
  (rid,2,'30g de queso oaxaca o manchego',30,'gramos'),
  (rid,3,'1 pimiento, zanahoria y calabaza en tiras',NULL,NULL),
  (rid,4,'½ tza de arroz cocido con verduras',0.5,'taza'),
  (rid,5,'⅓ pza (60g) de aguacate',60,'gramos');
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Saltea 120g de bistec en tiras con pimiento, zanahoria y calabaza hasta que estén suaves.'),
  (rid,2,'Añade el queso y mezcla hasta que se funda ligeramente.'),
  (rid,3,'Sirve con ½ taza de arroz con verduras y aguacate, formando un rollito o montado al gusto.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Hamburguesa', '🍔', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 pza de bimbollo',1,'pieza'),
  (rid,2,'90g de carne molida de res magra (95-5%) preparada con jitomate, ajo, cebolla y perejil',90,'gramos'),
  (rid,3,'30g de queso oaxaca o manchego',30,'gramos'),
  (rid,4,'1 cdita de mayonesa',1,'cucharadita'),
  (rid,5,'Jitomate, cebolla y lechuga',NULL,NULL);
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Mezcla la carne molida con jitomate, ajo, cebolla y perejil finamente picado; forma la hamburguesa y cocina.'),
  (rid,2,'Abre el bimbollo y unta mayonesa en la base.'),
  (rid,3,'Agrega la carne caliente, el queso, rodajas de jitomate, cebolla y lechuga. Cubre con la otra mitad.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pasta con atún al chipotle', '🍝', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 tza de pasta cocida al dente',1,'taza'),
  (rid,2,'1 lata de atún en agua (drenado)',1,'lata'),
  (rid,3,'2 jitomates, cebolla, cilantro, ajo, sal',NULL,NULL),
  (rid,4,'Chile chipotle al gusto',NULL,NULL),
  (rid,5,'3 cdas de crema',3,'cucharada');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Picadillo de res', '🥩', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'150g de carne molida de res magra (90-10%)',150,'gramos'),
  (rid,2,'3 pzas de jitomate + cebolla + ajo + chipotle',NULL,NULL),
  (rid,3,'Chícharo, zanahoria, calabaza y 70g de papa cocida en cubos',NULL,NULL),
  (rid,4,'2 paquetes de salmas o 4 tostadas horneadas',NULL,NULL),
  (rid,5,'60g de queso panela',60,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pollo con verdolagas', '🍗', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de pechuga de pollo o 2 piernas de pollo cocidas',NULL,NULL),
  (rid,2,'5 tomates verde (≈180–200g), 1 chile serrano, ¼ cebolla, 1 diente de ajo, cilantro, ½ taza de agua o caldo',NULL,NULL),
  (rid,3,'1 puño de verdolagas lavadas y desinfectadas',NULL,NULL),
  (rid,4,'1 tza de zanahoria, chícharo y ejotes',1,'taza'),
  (rid,5,'2 tortillas de maíz',2,'pieza');
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Cuece 120g de pechuga de pollo o 2 piernas y deshébralas.'),
  (rid,2,'Licúa los tomates verdes con el chile serrano, la cebolla, el ajo y el agua o caldo.'),
  (rid,3,'Cocina la salsa hasta que hierva; agrega el pollo y las verdolagas.'),
  (rid,4,'Deja cocinar unos minutos hasta que las verduras estén suaves. Termina con cilantro y sirve con 2 tortillas de maíz.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Filete a la paprika', '🥩', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de filete de pescado tilapia',120,'gramos'),
  (rid,2,'1 zanahoria en rodajas',1,'pieza'),
  (rid,3,'Jugo de 1 limón, paprika, ajo y sal',NULL,NULL),
  (rid,4,'⅓ pza (60g) de aguacate',60,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pescadillas', '🐟', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'160g de filete tilapia (120g cocidos)',160,'gramos'),
  (rid,2,'1 jitomate, cebolla picada finamente, ajo, hojas de laurel, sal',NULL,NULL),
  (rid,3,'3 tortillas de maíz',3,'pieza'),
  (rid,4,'1 cdita de aceite vegetal',1,'cucharadita'),
  (rid,5,'¼ tza de frijoles cocidos + 30g de queso panela',NULL,NULL);
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'En un sartén añade aceite y sofríe ajo y cebolla.'),
  (rid,2,'Añade jitomate, sal y pimienta; cocina hasta que suelte su jugo y se evapore.'),
  (rid,3,'Incorpora el filete de pescado, tapa, una vez cocido desmenúzalo e integra todo.'),
  (rid,4,'Rellena tortillas de maíz con la preparación, forma las pescadillas y dora en comal antes de servir.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Salmón a la pimienta', '🐟', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'160g de filete de salmón',160,'gramos'),
  (rid,2,'1 cdita de pimienta negra, ½ cdita de paprika, ajo en polvo, sal, jugo de limón',NULL,NULL),
  (rid,3,'1 cda de aceite vegetal',1,'cucharada'),
  (rid,4,'1 cdita de ralladura de limón y perejil fresco (opcional)',1,'cucharadita'),
  (rid,5,'1 tza de pasta cocida con 1 calabaza en cubos y 30g de queso panela',NULL,NULL);
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Sazona los filetes de salmón con pimienta, paprika, ajo en polvo, sal y jugo de limón.'),
  (rid,2,'Calienta aceite en una sartén a fuego medio-alto y cocina el salmón.'),
  (rid,3,'Al finalizar espolvorea ralladura de limón y perejil fresco al gusto.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Quesadillas de atún', '🌮', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 lata de atún en agua drenado',1,'lata'),
  (rid,2,'Jitomate, cebolla y ajo',NULL,NULL),
  (rid,3,'2 tortillas de maíz',2,'pieza'),
  (rid,4,'1 cdita de aceite para cocinar',1,'cucharadita'),
  (rid,5,'30g de queso panela',30,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Tortitas de pollo en salsa verde', '🍗', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de pechuga de pollo deshebrada',120,'gramos'),
  (rid,2,'1 huevo',1,'pieza'),
  (rid,3,'1 cda de avena en hojuelas',1,'cucharada'),
  (rid,4,'1 cdita de aceite vegetal',1,'cucharadita'),
  (rid,5,'Salsa verde (tomate, ajo, cebolla, chile habanero o serrano, cilantro)',NULL,NULL),
  (rid,6,'2 tortillas de maíz',2,'pieza');
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'En un recipiente, mezcla el pollo, huevo, sal, ajo en polvo y avena; integra hasta obtener una mezcla moldeable.'),
  (rid,2,'Engrasa la sartén y cocina las tortitas.'),
  (rid,3,'Aparte prepara la salsa verde; cuando esté hirviendo añade calabacitas y espera a que se cuezan.'),
  (rid,4,'Sumerge las tortitas en la salsa, sirve y disfruta.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Albóndigas de res', '🥩', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de carne molida de res 90–95% magra',120,'gramos'),
  (rid,2,'30g de queso panela',30,'gramos'),
  (rid,3,'⅔ tza de arroz cocido',0.666666667,'taza'),
  (rid,4,'Salsa de jitomate: 2 jitomates, ajo, cebolla, sal, caldo de pollo (o agua)',NULL,NULL),
  (rid,5,'1 tza de calabazas',1,'taza'),
  (rid,6,'1 cdita de aceite',1,'cucharadita'),
  (rid,7,'Ajo, sal y pimienta al gusto',NULL,NULL);
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'En un bowl, mezcla la carne con el queso, sal y pimienta; forma las albóndigas.'),
  (rid,2,'Hierve los ingredientes de la salsa, licúa y vierte en una sartén engrasada.'),
  (rid,3,'Agrega más agua e incorpora las albóndigas a la salsa.'),
  (rid,4,'Deja cocer tapado a fuego medio 15–20 minutos hasta que estén bien cocidas. Sirve con arroz.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pasta con pollo a la toscana', '🍝', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1½ tza de pasta cocida',1.5,'taza'),
  (rid,2,'120g de pechuga de pollo',120,'gramos'),
  (rid,3,'30g de queso panela en cubos',30,'gramos'),
  (rid,4,'2 jitomates, espinaca y cebolla picados',NULL,NULL),
  (rid,5,'1 cdita de aceite vegetal',1,'cucharadita');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Ceviche de atún', '🐟', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'200g de atún fresco (o dos latas de atún en agua)',200,'gramos'),
  (rid,2,'Pepino, zanahoria y cebolla morada',NULL,NULL),
  (rid,3,'½ pza de mango picado',0.5,'pieza'),
  (rid,4,'Jugo de limón y sal',NULL,NULL),
  (rid,5,'1 cdita de aceite de oliva',1,'cucharadita'),
  (rid,6,'2 paquetes de tostadas horneadas',2,'paquete');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Tostadas de pescado', '🐟', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'200g de filete de pescado tilapia marinado con chipotle, jugo de limón, aceite de oliva, pimienta, ajo en polvo y sal',200,'gramos'),
  (rid,2,'4 tostadas horneadas',4,'pieza'),
  (rid,3,'⅓ pza (30g) de aguacate',30,'gramos'),
  (rid,4,'Ensalada/salsa: ½ pza de mango picado, chile, pepino, cebolla morada, sal y limón',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Salmón en salsa de mango', '🐟', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'150g de filete de salmón',150,'gramos'),
  (rid,2,'1 cdita de pimienta negra, ½ cdita de paprika, ajo en polvo, sal, jugo de limón',NULL,NULL),
  (rid,3,'5g de mantequilla sin sal',5,'gramos'),
  (rid,4,'½ tza de mango picado, cebolla, cilantro, chile serrano y limón',NULL,NULL),
  (rid,5,'½ tza de arroz blanco cocido con verduras (zanahoria, chícharo)',0.5,'taza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Ensalada morada', '🥗', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'Cama de lechuga, espinaca o vegetales verdes',NULL,NULL),
  (rid,2,'Zanahoria, pepino, betabel y ½ manzana',NULL,NULL),
  (rid,3,'120g de pechuga de pollo deshebrada',120,'gramos'),
  (rid,4,'60g de queso panela en cubos',60,'gramos'),
  (rid,5,'1 tza de pasta cocida',1,'taza'),
  (rid,6,'1 cdita de aceite de oliva + 1 cdita de miel + jugo de limón + 1 cdita de mostaza + sal + pimienta',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pechuga rellena', '🍗', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de pechuga de pollo aplanada',120,'gramos'),
  (rid,2,'Espinaca y champiñones cocidos',NULL,NULL),
  (rid,3,'30g de queso oaxaca o mozarella',30,'gramos'),
  (rid,4,'30g de aguacate',30,'gramos'),
  (rid,5,'¾ tza de arroz cocido con verduras (chícharo, zanahoria)',0.75,'taza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Spaghetti a la boloñesa', '🍝', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1½ tza de pasta cocida al dente',1.5,'taza'),
  (rid,2,'120g de carne molida de res (90-10%)',120,'gramos'),
  (rid,3,'Zanahoria, apio, ajo y cebolla',NULL,NULL),
  (rid,4,'2 jitomates + salsa prego',NULL,NULL),
  (rid,5,'1 cda de queso parmesano',1,'cucharada'),
  (rid,6,'1 pza de pan integral',1,'pieza'),
  (rid,7,'Ensalada: lechuga, zanahoria, jitomate cherry, pepino, 30g de queso panela, aceite de oliva, limón y sal',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Enchiladas', '🌮', 'Comida', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'4 tortillas de maíz',4,'pieza'),
  (rid,2,'120g de pechuga de pollo deshebrada',120,'gramos'),
  (rid,3,'60g de queso panela',60,'gramos'),
  (rid,4,'1 cdita de crema ácida',1,'cucharadita'),
  (rid,5,'Salsa verde',NULL,NULL),
  (rid,6,'Rodajas de cebolla',NULL,NULL),
  (rid,7,'*Sopa de verduras',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pescado con papas horneadas', '🐟', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de filete tilapia',120,'gramos'),
  (rid,2,'1 pza de papa (140g aprox cruda)',140,'gramos'),
  (rid,3,'Sal, pimienta, perejil, romero y ajo en polvo',NULL,NULL),
  (rid,4,'Jugo de 1 limón',NULL,NULL),
  (rid,5,'5g de mantequilla',5,'gramos'),
  (rid,6,'½ tza de arroz blanco cocido al vapor',0.5,'taza'),
  (rid,7,'Ensalada: lechuga, jitomate, limón, 30g de queso, 5 pzas de fresa y 1 cdita de ajonjolí',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Pollo teriyaki', '🍗', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'180g de pechuga de pollo',180,'gramos'),
  (rid,2,'Pimiento, calabaza y zanahoria picados en julianas',NULL,NULL),
  (rid,3,'1 cda de salsa de soya maggie + 1 cdita de miel + maicena disuelta en poquita agua',NULL,NULL),
  (rid,4,'¾ tza de arroz cocido al vapor',0.75,'taza'),
  (rid,5,'1 cdita de aceite',1,'cucharadita');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Ensalada de pollo y garbanzo', '🥗', 'Comida', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'Cama de lechuga y arúgula (opcional)',NULL,NULL),
  (rid,2,'½ tza de arroz cocido al vapor',0.5,'taza'),
  (rid,3,'120g de pechuga de pollo cocida deshebrada',120,'gramos'),
  (rid,4,'½ tza de garbanzos',0.5,'taza'),
  (rid,5,'Pepino, ½ tza de mango, zanahoria y cebolla morada',NULL,NULL),
  (rid,6,'30g de queso fresco',30,'gramos'),
  (rid,7,'Limón y sal',NULL,NULL),
  (rid,8,'1 cdita de aceite vegetal',1,'cucharadita'),
  (rid,9,'1 cdita de pepitas o ajonjolí',1,'cucharadita');

-- ============================================================
-- CENAS
-- ============================================================

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Atún a la mexicana', '🐟', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 lata de atún en agua, drenar',1,'lata'),
  (rid,2,'Jitomate, cebolla y cilantro',NULL,NULL),
  (rid,3,'Limón y chile serrano al gusto',NULL,NULL),
  (rid,4,'¼ pza (30g) de aguacate',30,'gramos'),
  (rid,5,'2 paquetes de salmas',2,'paquete');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Tinga de pollo', '🍗', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'90g de pechuga de pollo deshebrada',90,'gramos'),
  (rid,2,'1 jitomate y cebolla en rodajas',NULL,NULL),
  (rid,3,'Chile chipotle',NULL,NULL),
  (rid,4,'Sal, pimienta y hojita de laurel',NULL,NULL),
  (rid,5,'2 paquetes de salmas',2,'paquete'),
  (rid,6,'30g de queso panela',30,'gramos');
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Saltea cebolla, agrega jitomate y chipotle.'),
  (rid,2,'Incorpora el pollo con laurel, sal y pimienta.'),
  (rid,3,'Sirve sobre salmas con queso panela.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Calabacitas asadas', '🥒', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 calabaza, 1 jitomate y cebolla picados',NULL,NULL),
  (rid,2,'90g de pechuga deshebrada de pollo',90,'gramos'),
  (rid,3,'40g de queso panela',40,'gramos'),
  (rid,4,'2 paquetes de salmas',2,'paquete');
INSERT INTO receta_pasos (receta_id, numero, descripcion) VALUES
  (rid,1,'Saltea calabaza, jitomate y cebolla picados.'),
  (rid,2,'Agrega el pollo deshebrado y cocina unos minutos.'),
  (rid,3,'Sirve sobre salmas y añade queso panela en cubos.');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Salpicón de res', '🥩', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'60g de carne deshebrada de res',60,'gramos'),
  (rid,2,'Jitomate, cebolla morada y 1 chile serrano',NULL,NULL),
  (rid,3,'Jugo de limón',NULL,NULL),
  (rid,4,'1 cdita de aceite de oliva',1,'cucharadita'),
  (rid,5,'¼ pza (30g) de aguacate',30,'gramos'),
  (rid,6,'2 paquetes de salmas',2,'paquete');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Carne con papas', '🥩', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'100g de carne molida magra (90-10%)',100,'gramos'),
  (rid,2,'½ pza de papa cocida',0.5,'pieza'),
  (rid,3,'Jitomate, zanahoria y cebolla',NULL,NULL),
  (rid,4,'30g de queso oaxaca reducido en grasa',30,'gramos'),
  (rid,5,'⅓ pza (30g) de aguacate',30,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Molletes', '🍞', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 pza de bolillo (optar por integral)',1,'pieza'),
  (rid,2,'4 cdas de frijoles machacados',4,'cucharada'),
  (rid,3,'30g de pechuga deshebrada de pollo',30,'gramos'),
  (rid,4,'4 rebanadas de pechuga de pavo',4,'rebanada'),
  (rid,5,'2 rebanadas de queso manchego bajo en grasa',2,'rebanada'),
  (rid,6,'Pico de gallo: 1 jitomate, cebolla, chile serrano, cilantro, sal y limón',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Mugcake', '🎂', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'½ tza de avena en hojuelas',0.5,'taza'),
  (rid,2,'2 huevos',2,'pieza'),
  (rid,3,'2 cdas de queso cottage',2,'cucharada'),
  (rid,4,'Chorrito de leche',NULL,NULL),
  (rid,5,'½ plátano',0.5,'pieza'),
  (rid,6,'1 cdita de cacao sin azúcar',1,'cucharadita'),
  (rid,7,'Polvo para hornear, vainilla y edulcorante al gusto',NULL,NULL),
  (rid,8,'Complementar con: queso cottage 1% restante, plátano y 5 fresas',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Salteado de pollo', '🍗', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'100g de pechuga de pollo',100,'gramos'),
  (rid,2,'½ taza de arroz integral cocido',0.5,'taza'),
  (rid,3,'1 cdita de aceite de canola',1,'cucharadita'),
  (rid,4,'Verduras a gusto: pimiento, calabacín, brócoli, zanahoria y cebolla',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Sincronizadas', '🌮', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 tortillas de maíz',2,'pieza'),
  (rid,2,'2 rebanadas de pechuga de pavo',2,'rebanada'),
  (rid,3,'45g de queso panela',45,'gramos'),
  (rid,4,'Pico de gallo con 40g de aguacate',NULL,NULL);

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Carne molida', '🥩', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120g de carne molida magra (90-10%)',120,'gramos'),
  (rid,2,'zanahoria, chícharo y elote',NULL,NULL),
  (rid,3,'1cdita de salsa de soya',1,'cucharadita'),
  (rid,4,'2 paquete de salmas',2,'paquete');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Picadillo', '🥩', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'120 g de carne molida de res magra (90/10)',120,'gramos'),
  (rid,2,'1 cucharadita de aceite vegetal',1,'cucharadita'),
  (rid,3,'½ taza de papa cocida en cubos',0.5,'taza'),
  (rid,4,'½ taza de jitomate picado, cebolla picada, 1diente de ajo',NULL,NULL),
  (rid,5,'Sal y pimienta al gusto',NULL,NULL),
  (rid,6,'2 paquetes de salmas',2,'paquete');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Taquitos de pollo poblano', '🌮', 'Cena', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'2 pzas de tortilla de maíz',2,'pieza'),
  (rid,2,'60g de pechuga de pollo deshebrada',60,'gramos'),
  (rid,3,'3 cditas de elote amarillo',3,'cucharadita'),
  (rid,4,'Fajitas de chile poblano desvenado',NULL,NULL),
  (rid,5,'30g de queso panela en cubitos',30,'gramos');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Arepas', '🫓', 'Cena', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'50g de harina de maíz (PAN)',50,'gramos'),
  (rid,2,'70ml de agua aprox',70,'mililitros'),
  (rid,3,'120g de pechuga de pollo sazonada al gusto (sugerencia: jitomate)',120,'gramos'),
  (rid,4,'30g de queso oaxaca o mozarella',30,'gramos'),
  (rid,5,'1 cdita de aceite vegetal',1,'cucharadita');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Ceviche de atún', '🐟', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 lata de atún en agua',1,'lata'),
  (rid,2,'pepino, jicama y zanahoria picada',NULL,NULL),
  (rid,3,'cilantro',NULL,NULL),
  (rid,4,'limón',NULL,NULL),
  (rid,5,'2 paquetes de salmas',2,'paquete');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Quesadillas de pollo a la mexicana', '🌮', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'90g de pechuga de pollo deshebrada',90,'gramos'),
  (rid,2,'60g de queso oaxaca',60,'gramos'),
  (rid,3,'1 jitomate, espinaca, y cebolla',NULL,NULL),
  (rid,4,'2 piezas de tortilla de maíz',2,'pieza');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Atún al chipotle', '🐟', 'Cena', 'Fácil', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 lata de atún en agua drenado',1,'lata'),
  (rid,2,'1 jitomate + cebolla + chile chipotle',NULL,NULL),
  (rid,3,'1cdita de aceite vegetal',1,'cucharadita'),
  (rid,4,'zanahoria, chícharo y elote',NULL,NULL),
  (rid,5,'2 paquetes de salmas',2,'paquete');

INSERT INTO recetas (nombre, emoji, tipo, nivel, porciones)
  VALUES ('Sopecitos de pollo', '🍗', 'Cena', 'Medio', '1') RETURNING id INTO rid;
INSERT INTO receta_ingredientes (receta_id, orden, descripcion, cantidad, unidad) VALUES
  (rid,1,'1 pza de sope de maíz',1,'pieza'),
  (rid,2,'1cda de frijoles refritos',1,'cucharada'),
  (rid,3,'60g de pechuga deshebrada de pollo',60,'gramos'),
  (rid,4,'30g de queso panela',30,'gramos'),
  (rid,5,'jitomate, cebolla y nopales cocidos',NULL,NULL);

END $$;
