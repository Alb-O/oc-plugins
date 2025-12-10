{
  mkBunDerivation,
  bunNix,
  src,
  ...
}:

mkBunDerivation {
  pname = "opencodium";
  version = "1.0.0";
  src = src;
  bunNix = bunNix;
}
