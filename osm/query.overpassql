[out:json][timeout:120];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](53.328,-6.318,53.362,-6.232);
  way["highway"~"^(footway|path|steps)$"]["name"](53.328,-6.318,53.362,-6.232);
  way["highway"="footway"]["bridge"="yes"](53.328,-6.318,53.362,-6.232);
  way["waterway"~"^(river|canal)$"](53.320,-6.330,53.370,-6.220);
  way["leisure"~"^(park|garden)$"](53.328,-6.335,53.365,-6.232);
  relation["leisure"="park"](53.328,-6.335,53.365,-6.232);
  way["railway"="tram"](53.328,-6.318,53.362,-6.232);
);
out geom;
