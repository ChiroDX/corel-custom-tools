//Calculate the page width and height, and store the values in pWidth and pHeight.
pWidth = host.ActivePage.SizeWidth

pHeight = host.ActivePage.SizeHeight


//alert("page width is: " + pWidth);
//alert("page height is: " + pHeight);
//alert("Page Size is: " + host.ActivePage.Paper);

//Create a new layer, called “New Watermark”, on the active page.
let lr2 = host.ActivePage.CreateLayer("New Watermark");

//Create a rectangle the size of the page, and place it on the Watermark layer.
let s1 = lr2.CreateRectangle(0, pHeight, pWidth, 0);

//Add the artistic text Company Name to the Watermark layer, in the lower-right corner of the page.
let s2 = lr2.CreateArtisticText(pWidth-3, 0.5, "Company Name");

//Set the color of the text object to be 100% black.
s2.Fill.UniformColor.CMYKAssign(0, 0, 0, 100);

//Set the transparency of the text object to 70%.
s2.transparency.ApplyUniformTransparency(70);

//Add the artistic text Watermark to the Watermark layer.
let s3 = lr2.CreateArtisticText(pWidth/2-3.4, pHeight/2, "Watermark", undefined , undefined, undefined, 100);

//Set the color of the text object to be 100% black.
s3.Fill.UniformColor.CMYKAssign(0, 0, 0, 100);

//Set the transparency of the text object to 70%.
s3.transparency.ApplyUniformTransparency(70);

//Rotate the text object by 45 degrees.
s3.Rotate(45);

//Set focus back to base layer.
host.ActiveLayer.Below().Activate();