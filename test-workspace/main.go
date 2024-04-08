package main

type Translator struct {
}

func (t *Translator) Tr(path string) string {
	return "Hello"
}

func main() {
	ctx := Translator{}
	ctx.Tr("test.abc.ssss")
}